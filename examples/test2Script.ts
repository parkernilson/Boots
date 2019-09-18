import { BootsScript, BootsScriptResult } from '../BootsScript';
export default <BootsScript> {
    bootsScriptName: 'test2-script',
    run(): Promise<BootsScriptResult> {
        return new Promise<BootsScriptResult>((resolve, reject) => {

            setTimeout(()=>reject(<BootsScriptResult> {success: false, error: `${this.bootsScriptName} had an oopsie :-(`, scriptName: this.bootsScriptName }), 1000)

        })
    }
}