export class Deffered<T = void>{
    public resolve!: (val: T) => void
    public reject!: (readon?: any) => void
    readonly promise = new Promise<T>((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
    })
}