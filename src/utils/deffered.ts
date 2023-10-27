export class Deffered<T = void>{
    public resolve!: (val: T) => void
    public reject!: (readon?: any) => void
    resolved = false
    readonly promise = new Promise<T>((resolve, reject) => {
        this.resolve = (v) => {
            resolve(v)
            this.resolved = true
        }
        this.reject = reject
    })
}