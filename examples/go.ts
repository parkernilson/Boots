/**
 * This example demonstrates a basic implementation using boots.go()
 */

import { Boots, BootsScriptResult } from '..';
import { BootsScript } from '../BootsScript';

let boots: Boots = new Boots();

let subscription = boots.go().subscribe({
    next(result: BootsScriptResult) {
        console.log(`script ${result.scriptName} was successful`)
    },
    error(error: string) {
        console.error(error)
        boots.logErrors();
    },
    complete() {
        if(boots.ok) {
            console.log('Boots Scripts were run successfully')
        } else {
            console.error('Boots Scripts were unsuccessful')
        }
        subscription.unsubscribe();
    }
})