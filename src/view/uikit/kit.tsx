import React, { useContext } from "react";
import Linkify from "linkify-react";
import { WebApp } from "../utils/webapp";
import { useVMvalue } from "../../utils/vm/useVM";
import { UsersProviderContext } from "../MainScreen";

export const BackgroundContext = React.createContext("var(--tg-theme-bg-color)")

export const Card = ({ children, style, onClick }: { children: any, style?: any, onClick?: React.MouseEventHandler<HTMLDivElement> }) => {
    return <div onClick={onClick} className={onClick ? "card" : undefined} style={{ display: 'flex', flexDirection: 'column', margin: '8px 16px', padding: 4, backgroundColor: "var(--tg-theme-secondary-bg-color)", borderRadius: 16, ...style }}>
        <BackgroundContext.Provider value="var(--tg-theme-secondary-bg-color)">
            {children}
        </BackgroundContext.Provider>
    </div>
}

export const Button = ({ children, style, onClick, disabled }: { children: any, style?: any, onClick?: React.MouseEventHandler<HTMLButtonElement>, disabled?: boolean }) => {
    return <button disabled={disabled} onClick={onClick} style={{ margin: '8px 16px', padding: 0, backgroundColor: "var(--tg-theme-secondary-bg-color)", borderRadius: 8, ...style }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: 4, opacity: disabled ? 0.8 : undefined }}>{children}</div>
    </button>
}


export const CardLight = ({ children, style }: { children: any, style?: any }) => {
    return <div style={{ display: 'flex', flexDirection: 'column', margin: '0px 20px', ...style }}>{children}</div>
}

export const Link = ({ attributes, content }: { attributes: any, content: any }) => {
    const { href, ...props } = attributes;
    const onClick = React.useCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        e.stopPropagation();
        const url = new URL(href);
        if (url.host === "t.me") {
            WebApp?.openTelegramLink(href);
        } else {
            WebApp?.openLink(href);
        }
    }, [href])
    return <a onClick={onClick} href={href} {...props}>{content}</a>;
};

export const ListItem = React.memo(({ titile: title, titleView, subtitle, subtitleView, right, style, titleStyle, subTitleStyle, rightStyle, leftStyle, onClick, onSubtitleClick }: { titile?: string, titleView?: React.ReactNode, subtitle?: string, subtitleView?: React.ReactNode, right?: React.ReactNode, style?: any, titleStyle?: any, subTitleStyle?: any, rightStyle?: any, leftStyle?: any, onClick?: React.MouseEventHandler<HTMLDivElement>, onSubtitleClick?: React.MouseEventHandler<HTMLDivElement> }) => {
    return <div className={onClick ? "list_item" : undefined} onClick={onClick} style={{ display: 'flex', flexDirection: "row", justifyContent: 'space-between', padding: 4, alignItems: 'center', ...style }}>
        <div style={{ display: 'flex', padding: '2px 0px', flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0, ...leftStyle }}>
            {!!title && <div style={{ padding: '2px 4px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', ...titleStyle }}>{title}</div>}
            {titleView && <div style={{ padding: '2px 4px' }}>
                {titleView}
            </div>}
            {!!subtitle && <Linkify options={{ render: Link }}>
                <div onClick={onSubtitleClick} style={{ padding: '2px 4px', fontSize: '0.8em', color: "var(--tg-theme-hint-color)", whiteSpace: 'pre-wrap', textOverflow: 'ellipsis', overflow: 'hidden', ...subTitleStyle }}>{subtitle}</div>
            </Linkify>}
            {subtitleView && <div style={{ padding: '2px 4px' }}>
                {subtitleView}
            </div>}
        </div>
        {!!right && <div style={{ display: 'flex', padding: '4px 16px', flexShrink: 0, alignItems: 'center', ...rightStyle }}>{right}</div>}
    </div>
}
)

const colors = [
    'var(--color-user-1)',
    'var(--color-user-8)',
    'var(--color-user-5)',
    'var(--color-user-2)',
    'var(--color-user-7)',
    'var(--color-user-4)',
    'var(--color-user-6)',
]
export const UserPic = React.memo(({ uid, style }: { uid: number, style?: any }) => {
    const usersModule = React.useContext(UsersProviderContext)
    const user = useVMvalue(usersModule.getUser(uid))
    const backgroundColor = useContext(BackgroundContext)
    const color = colors[uid % colors.length]

    const [imageLoadError, setImageLoadError] = React.useState<boolean>(false)

    const onImageError = React.useCallback(() => {
        setImageLoadError(true)
    }, [])

    const showImg = user.imageUrl && !imageLoadError;

    return <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: 24,
        height: 24,
        border: `2px solid ${backgroundColor}`,
        backgroundColor: color,
        backgroundImage: showImg ? `url(${user.imageUrl})` : `linear-gradient(white -125%, ${color})`,
        backgroundSize: 'cover',
        borderRadius: 24,
        ...style
    }}  >
        {!showImg && <div style={{ fontSize: '12px' }} >{[user.firstName, user.lastname].filter(Boolean).map(e => e?.charAt(0)).join('')} </div>}
        {user.imageUrl && <img src={user.imageUrl} style={{ display: 'none' }} onError={onImageError} />}
    </div>
})


export const Counter = React.memo(({ style, text }: { style?: any, text: string }) => {
    const backgroundColor = useContext(BackgroundContext)
    const color = "gray"

    return <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: 24,
        height: 24,
        border: `2px solid ${backgroundColor}`,
        backgroundColor: color,
        backgroundImage: `linear-gradient(white -125%, ${color})`,
        backgroundSize: 'cover',
        borderRadius: 24,
        ...style
    }}  >
        <div style={{ fontSize: '12px' }} >{text} </div>
    </div>
})

export const UsersPics = React.memo(({ uids, limit }: { uids: number[], limit?: number }) => {
    limit = limit ?? 5
    const overflow = uids.length > limit ? (uids.length - limit + 1) : 0;
    const showLength = overflow ? uids.length - overflow : uids.length;
    return <div style={{ display: 'flex', flexDirection: 'row' }}>
        {uids.slice(0, showLength).map((uid, index) => <UserPic key={uid} uid={uid} style={{ marginRight: -8, zIndex: uids.length - index }} />)}
        {!!overflow && <Counter text={`+${overflow}`} style={{ marginRight: -8, zIndex: uids.length }} />}
    </div>
})
