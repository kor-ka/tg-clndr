import {
    useNavigate as useReactRouterNavigate,
} from "react-router-dom";

export const useSSRReadyNavigate = () => {
    if (typeof window !== "undefined") {
        return useReactRouterNavigate()
    } else {
        return () => { }
    }
}