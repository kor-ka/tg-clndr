import React from "react";
import { To, useNavigate, Location } from "react-router-dom";

export const homeLoc = { location: undefined }
export const HomeLoc = React.createContext<{ location: Location | undefined }>(homeLoc);

export const useGoHome = () => {
    const nav = useNavigate();
    const homeLoc = React.useContext(HomeLoc).location
    return React.useCallback(() => {
        nav(homeLoc ?? -1 as To)
    }, []);
}

export const useGoBack = () => {
    const nav = useNavigate();
    return React.useCallback(() => {
        nav(-1)
    }, []);
}