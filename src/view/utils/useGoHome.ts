import React from "react";
import { To, useNavigate } from "react-router-dom";
import { HomeLoc } from "../MainScreen";

export const useGoHome = () => {
    const nav = useNavigate();
    const homeLoc = React.useContext(HomeLoc).loc
    return React.useCallback(() => {
        nav(homeLoc ?? -1 as To)
    }, []);
}