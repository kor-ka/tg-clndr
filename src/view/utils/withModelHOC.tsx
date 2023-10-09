import React, { useContext } from "react";
import { ModelContext } from "../ModelContext";

export const WithModel = <P,>(Component: React.FunctionComponent<P>): React.FunctionComponent<Omit<P, 'model'>> => {
    return function WithModel(p: P) {
        const model = useContext(ModelContext);
        return model ? <Component {...p} model={model} /> : null
    } as React.FunctionComponent<Omit<P, 'model'>>
}

