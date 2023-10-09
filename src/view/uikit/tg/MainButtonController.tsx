import React from "react";
import { WebApp, __DEV__ } from "../../utils/webapp";

export const MainButtonController = React.memo(({ onClick, text, color, textColor, isActive, isVisible, progress }: { onClick: () => void, text?: string, color?: string, textColor?: string, isActive?: boolean, isVisible?: boolean, progress?: boolean }) => {
    const mb = React.useMemo(() => WebApp?.MainButton, [])

    React.useEffect(() => {
        mb.onClick(onClick)
        return () => {
            mb.offClick(onClick)
        }
    }, [onClick])


    React.useEffect(() => {
        if (progress !== mb.isProgressVisible) {
            if (progress) {
                mb.showProgress()
            } else {
                mb.hideProgress()
            }
        }

    }, [progress])

    React.useEffect(() => {
        mb.setParams({ text, color, text_color: textColor, is_active: isActive ?? true, is_visible: isVisible ?? true })
    }, [text, color, textColor, isActive, isVisible])

    return (__DEV__ && isVisible !== false) ? <button style={{ position: 'absolute', top: 0, right: 0 }} disabled={isActive === false} onClick={onClick} >{text}{progress ? "⌛️" : ""}</button> : null
})
