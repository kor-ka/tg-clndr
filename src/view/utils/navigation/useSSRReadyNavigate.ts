import {
    useNavigate as reactRouterNavigate,
} from "react-router-dom";

export const useSSRReadyNavigate = () => {
    if (typeof window !== "undefined") {
        return reactRouterNavigate()
    } else {
        return () => { }
    }
}