import { BootsScript, BootsScriptResult } from '../BootsScript';
export default <BootsScript> {
    bootsScriptName: 'test-script',
    run(): Promise<BootsScriptResult> {
        return new Promise<BootsScriptResult>((resolve, reject) => {

            setTimeout(()=>resolve(<BootsScriptResult> {success: true, scriptName: this.bootsScriptName}), 1000)

        })
    }
}