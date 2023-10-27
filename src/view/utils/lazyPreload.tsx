import { ComponentType, lazy } from "react";

export const lazyPreload = <T extends ComponentType<any>>(factory: () => Promise<{ default: T }>, waitFor?: Promise<unknown>) => {
    let cached: { default: T } | undefined
    const wrapped = async () => {
        await waitFor
        cached = await factory()
        return cached
    }
    let preload: Promise<{ default: T }>
    if (typeof window !== 'undefined') {
        preload = wrapped()
    }
    const lazyComponent = lazy(async () => {
        return preload ?? wrapped()
    })
    return ((props: any) => {
        const Component = (cached?.default ?? lazyComponent) as React.ExoticComponent<T>
        return <Component {...props} />
    }) as React.LazyExoticComponent<T>
}