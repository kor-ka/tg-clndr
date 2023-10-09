import {
    Location,
    useLocation as reactRouterLocation,
} from "react-router-dom";

export const useSSRReadyLocation = (): Location => {
    if (typeof window !== "undefined") {
        return reactRouterLocation()
    } else {
        return { state: {}, key: 'default', pathname: '', search: '', hash: '' }
    }
}
