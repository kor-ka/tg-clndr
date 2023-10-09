import {
    Location,
    useLocation as useReactRouterLocation,
} from "react-router-dom";

export const useSSRReadyLocation = (): Location => {
    if (typeof window !== "undefined") {
        return useReactRouterLocation()
    } else {
        return { state: {}, key: 'default', pathname: '', search: '', hash: '' }
    }
}
