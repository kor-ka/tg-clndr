
export class PremountController {
    static INSTANCE = new PremountController()
    private onClickMounted = false
    private pending = false
    private wa: any

    private constructor() { }

    private onPreMountCLick = () => {
        this.pending = true
        this.wa?.MainButton.showProgress()
    }

    readonly init = () => {
        this.wa = typeof window !== "undefined" ? (window as any).Telegram.WebApp : undefined
        this.wa?.MainButton.onClick(this.onPreMountCLick)
    }

    readonly onMount = (onClick: () => void) => {
        if (!this.onClickMounted) {
            this.onClickMounted = true
            this.wa?.MainButton.offClick(this.onPreMountCLick)
            if (this.pending) {
                this.pending = false
                this.wa?.MainButton.hideProgress()
                console.log('PremountController: onClick call')

                onClick()
            }
        }
    }
}