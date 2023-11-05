export class Deffered<T = void>{
    public resolve!: (val: T) => void
    public reject!: (reason: Error) => void
    result: { error?: never, val: T } | { val?: never, error: Error } | undefined
    readonly promise = new Promise<T>((resolve, reject) => {
        this.resolve = (val) => {
            resolve(val)
            this.result = { val }
        }
        this.reject = (error) => {
            reject(error)
            this.result = { error }
        }
    })
}