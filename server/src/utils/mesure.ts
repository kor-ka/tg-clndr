export const mesure = <T>(factory: () => Promise<T>, tag: string) => {
    const time = Date.now()
    const promise = factory()
    promise.then(() => {
        console.log(tag, Date.now() - time)
    }).catch(e => console.log(e))
    return promise
}
