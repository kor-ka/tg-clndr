import React from "react";
import { useSearchParams } from "react-router-dom";
import { Event } from "../shared/entity";
import { useVMvalue } from "../utils/vm/useVM";
import { UsersProvider, ModelContext, BackButtopnController, CardLight, ListItem, MainButtopnController, showConfirm, Button, HomeLoc } from "./MainScreen";
import { useHandleOperation } from "./useHandleOperation";
import { useGoHome } from "./utils/useGoHome";

export const AddTransferScreen = () => {
    const model = React.useContext(ModelContext);

    let [searchParams] = useSearchParams();

    const editEvId = searchParams.get("editEvent");
    const editEv: Event | undefined = editEvId ? model?.eventsModule.getOperationOpt(editEvId) : undefined;

    let disable = !!editEv?.deleted;

    const [title, setTitle] = React.useState(editEv?.title ?? '')
    const onTitleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
    }, [])

    const [description, setDscription] = React.useState(editEv?.description ?? '')
    const onDescriptionInputChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setDscription(e.target.value);
    }, [])

    const [date, setDate] = React.useState(new Date(editEv?.date ?? Date.now() + 1000 * 60 * 60));
    const onDateInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDate(new Date(e.target.value));
    }, [])

    const goHome = useGoHome()
    const [handleOperation, loading] = useHandleOperation(goHome);

    disable = disable || loading

    const onClick = React.useCallback(() => {
        if (model) {
            handleOperation(
                model.commitCommand({
                    type: editEv ? 'update' : 'create',
                    event: {
                        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        id: editEv?.id ?? model.nextId() + '',
                        title: title.trim(),
                        description: description.trim(),
                        date: date.getTime(),
                    }
                }))
        }

    }, [date, title, description, model, editEv, handleOperation]);

    const onDeleteClick = React.useCallback(() => {
        showConfirm("Delete event? This can not be undone.", (confirmed) => {
            if (confirmed && model && editEvId) {
                handleOperation(
                    model.commitCommand({
                        type: 'delete',
                        id: editEvId
                    }))
            }
        })
    }, [model, editEvId, handleOperation])

    console.log(date.toISOString().slice(0, 19))

    const crazyDateFormat = React.useMemo(() => {
        var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
        return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, -8);
    }, [date])
    return <>
        <BackButtopnController />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 0px' }}>

            <input value={title} onChange={onTitleInputChange} autoFocus={true} disabled={disable} style={{ flexGrow: 1, padding: '8px 28px' }} placeholder="Title" />
            <input value={crazyDateFormat} onChange={onDateInputChange} disabled={disable} type="datetime-local" style={{ flexGrow: 1, margin: '8px 28px' }} />
            <textarea value={description} onChange={onDescriptionInputChange} disabled={disable} style={{ flexGrow: 1, padding: '8px 28px', height: 128 }} placeholder="Description" />

            {editEv && <Button disabled={disable} onClick={onDeleteClick}><ListItem titleStyle={{ color: "var(--text-destructive-color)", alignSelf: 'center' }} titile="DELETE EVENT" /></Button>}
        </div>
        <MainButtopnController onClick={onClick} text={(editEv ? "EDIT" : "ADD") + " EVENT"} progress={loading} />
    </>
}