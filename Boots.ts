import { Observable, of, throwError, Subscriber, Subscription } from 'rxjs';
import { BootsScript, BootsScriptResult, isBootsScript } from './BootsScript';
import * as path from 'path';

/**
 * Boots is a database bootstrapper, allowing you to specify scripts that should be run before program
 * execution ensuring that the database has proper structure. Intended for use during development for
 * specifying different database configurations for tests, etc.
 * 
 * Scripts to run are specified in the commandline with:
 * --boots <relative or absolute path to script module> <another script> ... <many scripts may be specified>
 * 
 * Scripts will be run in order of specification and in serial.
 */
export class Boots {

    /** array of paths to scripts that will be run during Boots execution */
    private scriptPaths: string[]; 
    /** the boots scripts that have been loaded */
    private bootsScripts: BootsScript[];

    /** The commandline flag used to pass script names to Boots */
    static commandlineFlag: string = '--boots';

    //SETTINGS
    /** The base url used to prepend to relative paths to get absolute paths in project. Default value is process.cwd() */
    private baseUrl: string = process.cwd();

    /** An array of any errors that occur during Boots execution */
    private errors: string[];

    /** true if no errors have occurred within Boots */
    public ok: boolean;

    constructor(options?: BootsOptions) {
        this.scriptPaths = [];
        this.ok = true;
        this.bootsScripts = [];
        this.errors = [];

        if(options) {
            if(options.baseUrl) this.baseUrl = options.baseUrl;
        }
    }

    /** 
     * Load scripts using filepaths that were specified in commandline with --boots, then execute the scripts in order. 
     * @return - Observable of the result of each script execution.
     */
    go(): Observable<BootsScriptResult> { //TODO: this should return an observable which will observe the results of the scripts
        //load script paths from command line
        this.scriptPaths = this._loadScriptPaths(); 
        if(this.scriptPaths.length < 1) {
            this.ok = false;
            return throwError('Boots Error: No script paths were specified.')
        }
        //check specified modules for validity
        let checkModules: LoadModulesResult = this._loadModules(this.scriptPaths);
        if(!checkModules.ok){ //if there were any problems with the given BootsScript modules, log them here
            this.ok = false;
            let errorMessage: string = '';
            if(checkModules.cantResolve) {
                this.errors.push(`Could not resolve the following paths: ${JSON.stringify(checkModules.cantResolve)}`)
            }
            if(checkModules.wrongType) {
                this.errors.push(`The following given BootsScript modules had no default export that was an instance of BootsScript: ${JSON.stringify(checkModules.wrongType)}`)
            }
            return throwError('Boots Error: At least one error occurred while attempting to load the BootsScript modules. Use Boots.logErrors() to view more information.'); 
        }
        else {
            //if module checks passed, run scripts and return observable of script execution
            return this._runScripts();
        }
    }

    /** Log all errors that were recorded during the execution of Boots */
    logErrors(): void {
        for(let error of this.errors) {
            console.log(`Boots Error: ${error}`);
        }
    }

    private _runScripts(): Observable<BootsScriptResult> {
        return new Observable<BootsScriptResult>((subscriber: Subscriber<BootsScriptResult>): Subscription => {
            //run the scripts in order, asynchronously. See: https://decembersoft.com/posts/promises-in-serial-with-array-reduce/
            //promise chain acts as 'accumulator'. It is a Promise of the array of results
            this.bootsScripts.reduce((promiseChain: any, currentTask: BootsScript) => {
                //wait for the promise chain (a promise of an array of the previous results. The initial result array is: [])
                return promiseChain.then((chainResults: BootsScriptResult[]) => {
                    //then run the current task and wait for its promise to resolve.
                    return currentTask.run().then((currentResult: BootsScriptResult) => {
                        //when the current task promise resolves, send to subscriber
                        subscriber.next(currentResult);
                        //append current result to chain results, then bubble it back up to eventually become the new accumulator value
                        return [...chainResults, currentResult]
                    }).catch((errorResult: BootsScriptResult) => { throw errorResult; })
                }).catch((errorResult: BootsScriptResult) => { throw errorResult; })
            }, Promise.resolve([])) //use empty array promise as initial accumulator value
            .then((arrayOfResults: BootsScriptResult[]) => {
                //complete observable when all scripts have been run.
                subscriber.complete();
            })
            .catch((errorResult: BootsScriptResult) => {
                this.ok = false; //an error has occurred, therefore the ok flag should be set to false
                subscriber.error(`Boots Error: Script ${errorResult.scriptName} reported the following error: ${errorResult.error}`);
            })
            
            //give the subscription to the subscriber
            return new Subscription(function unsubscribe() {
                //TODO: teardown logic goes here.
            })
        })
    }

    private _loadModules(scriptPaths: string[]): LoadModulesResult {
        let result: LoadModulesResult = { ok: true };
        //try to require each script path. If any of them are not resolvable, return false.
        scriptPaths.forEach((scriptPath: string, index: number, array: string[]) => {
            try {
                let bootsScript: BootsScript 
                try { 
                    //first try to load given path as an absolute path
                    bootsScript = require(scriptPath).default;
                } catch(error) {
                    //then try to load given path with base url prepended
                    scriptPath = path.join(this.baseUrl, scriptPath);
                    bootsScript = require(scriptPath).default;
                }
                //check if the module is a BootsScript
                if(isBootsScript(bootsScript)) {
                    //if the script was loaded successfully, push it to the array of scripts
                    this.bootsScripts.push(bootsScript);
                } else {
                    result.ok = false;
                    result.wrongType
                        ? result.wrongType.push(scriptPath) //if wrongType is defined, push to it
                        : result.wrongType = [scriptPath]; //if wrongType is not defined, define it
                }
            } catch(error) {
                //if error is thrown, the module couldn't be resolved
                result.ok = false;
                result.cantResolve
                    ? result.cantResolve.push(scriptPath)
                    : result.cantResolve = [scriptPath];
            }
        })
        return result;
    }

    private _loadScriptPaths(): string[] {
        //load the script names from the commandline args here
        let scriptPaths: string[] = [];

        //read commandline arguments and for each argument after --paths flag that isn't another flag, add that argument as a path to the script paths array
        process.argv.forEach((value: string, index: number, array: string[]) => {
            if(value === Boots.commandlineFlag) {
                let searching = index + 1;
                while(searching < array.length && array[searching][0] !== '-') {
                    scriptPaths.push(array[searching]);
                    ++searching;
                }
            }
        })
        return scriptPaths;
    }
}

/** The result of loading one or more BootsScript module paths */
interface LoadModulesResult {
    /** true if there were no problems, false otherwise */
    ok: boolean;
    /** an array of paths that could not be resolved */
    cantResolve?: string[];
    /** an array of objects representing the paths with wrong types and their types */
    wrongType?: string[];
}

interface BootsOptions {
    /** override the default baseUrl for resolving script paths */
    baseUrl?: string;
    /** clear the database before running scripts. NOTE: THIS WILL DROP EVERYTHING FROM THE DATABASE. This is intended for development use. */
    forceSync?: boolean;
}