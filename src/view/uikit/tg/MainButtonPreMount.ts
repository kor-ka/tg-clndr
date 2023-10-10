
export class PremountController {
    static INSTANCE = new PremountController()
    private onClickMounted = false
    private pending = false
    private mb: any

    private constructor() { }

    private onPreMountCLick = () => {
        this.pending = true
        this.mb?.MainButton.showProgress()
    }

    readonly init = () => {
        this.mb = typeof window !== "undefined" ? (window as any).Telegram.WebApp : undefined
        this.mb?.MainButton.onClick(this.onPreMountCLick)
    }

    readonly onMount = (onClick: () => void) => {
        if (!this.onClickMounted) {
            this.onClickMounted = true
            this.mb?.MainButton.offClick(this.onPreMountCLick)
            if (this.pending) {
                this.pending = false
                this.mb?.MainButton.hideProgress()
                onClick()
            }
        }
    }
}