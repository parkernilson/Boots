
/** The result of a BootsScript execution. */
export interface BootsScriptResult {
    /** whether the script executed without error */
    success: boolean;
    /** an error string or object if there was any */
    error?: any
    /** name of the script that failed */
    scriptName: string;
}

export interface BootsScript {
    bootsScriptName: string;
    run(): Promise<BootsScriptResult>;
}

export function isBootsScript(o: any): o is BootsScript {
    return (typeof o.run === 'function') && o.bootsScriptName;
}