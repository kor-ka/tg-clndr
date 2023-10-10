import { init } from "linkifyjs"
import { WebApp } from "../../utils/webapp"

export class PremountController {
    static INSTANCE = new PremountController()
    private onClickMounted = false
    private pending = false

    private constructor() { }

    private onPreMountCLick = () => {
        this.pending = true
        WebApp?.MainButton.showProgress()
    }

    readonly init = () => {
        WebApp?.MainButton.onClick(this.onPreMountCLick)
    }

    readonly onMount = (onClick: () => void) => {
        if (!this.onClickMounted) {
            this.onClickMounted = true
            WebApp?.MainButton.offClick(this.onPreMountCLick)
            if (this.pending) {
                this.pending = false
                WebApp?.MainButton.hideProgress()
                onClick()
            }
        }
    }
}