import React from "react";
import { WebApp, __DEV__ } from "../../utils/webapp";

export const HeaderColorController = React.memo(({ color }: { color: 'bg_color' | 'secondary_bg_color' | `#${number}${number}${number}${number}${number}${number}` }) => {
    React.useEffect(() => {
        WebApp?.setHeaderColor(color)
    }, [color])
    return null
})