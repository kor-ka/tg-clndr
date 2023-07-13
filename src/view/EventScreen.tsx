import React from "react";
import { useSearchParams } from "react-router-dom";
import { Event } from "../shared/entity";
import { useVMvalue } from "../utils/vm/useVM";
import { UsersProvider, ModelContext, BackButtopnController, CardLight, ListItem, MainButtopnController, showConfirm, Button, HomeLoc, UserContext } from "./MainScreen";
import { useHandleOperation } from "./useHandleOperation";
import { useGoHome } from "./utils/useGoHome";

export const EventScreen = () => {
    const model = React.useContext(ModelContext);
    const uid = React.useContext(UserContext);

    let [searchParams] = useSearchParams();

    const editEvId = searchParams.get("editEvent");
    const editEv: Event | undefined = editEvId ? model?.eventsModule.getOperationOpt(editEvId) : undefined;

    let disable = !!editEv?.deleted;

    const [edited, setEdited] = React.useState(false);

    const [title, setTitle] = React.useState(editEv?.title ?? '');
    const onTitleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
        setEdited(true);
    }, []);

    const [description, setDscription] = React.useState(editEv?.description ?? '');
    const onDescriptionInputChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setDscription(e.target.value);
        setEdited(true);
    }, []);

    const [date, setDate] = React.useState(new Date(editEv?.date ?? Date.now() + 1000 * 60 * 60));
    const onDateInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDate(new Date(e.target.value));
        setEdited(true);
    }, []);

    const goHome = useGoHome();
    const [handleOperation, loading] = useHandleOperation(goHome);

    disable = disable || loading;

    // 
    // ADD/SAVE
    // 
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

    // 
    // STATUS
    // 

    const status = React.useMemo(() => {
        if (editEv !== undefined && uid !== undefined) {
            return editEv.attendees.yes.includes(uid) ? 'yes' : editEv.attendees.no.includes(uid) ? 'no' : editEv.attendees.maybe.includes(uid) ? 'maybe' : undefined
        }
    }, [editEv?.attendees, uid]);

    const onStatusChange = React.useCallback((s: 'yes' | 'no' | 'maybe') => {
        if (model && editEvId && s !== status) {
            handleOperation(
                model.updateStatus(editEvId, s));
        }
    }, [model, editEvId, status]);
    const onStatusChangeYes = React.useCallback(() => onStatusChange('yes'), [onStatusChange]);
    const onStatusChangeNo = React.useCallback(() => onStatusChange('no'), [onStatusChange]);
    const onStatusChangeMaybe = React.useCallback(() => onStatusChange('maybe'), [onStatusChange]);


    // 
    // DELETE
    // 
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
    }, [model, editEvId, handleOperation]);

    const showButton = !editEv || edited;

    const crazyDateFormat = React.useMemo(() => {
        var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
        return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, -8);
    }, [date]);

    return <>
        <BackButtopnController />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 0px' }}>

            <input value={title} onChange={onTitleInputChange} autoFocus={true} disabled={disable} style={{ flexGrow: 1, padding: '8px 28px' }} placeholder="Title" />
            <input value={crazyDateFormat} onChange={onDateInputChange} disabled={disable} type="datetime-local" style={{ flexGrow: 1, margin: '8px 12px', padding: '0px 12px' }} />
            <textarea value={description} onChange={onDescriptionInputChange} disabled={disable} style={{ flexGrow: 1, padding: '8px 28px', height: 128 }} placeholder="Description" />

            {editEv && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={onStatusChangeYes} style={status === 'yes' ? { backgroundColor: '--tg-theme-button-color' } : undefined}><ListItem titleStyle={{ color: status === 'yes' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)', alignSelf: 'center' }} titile="Accept" /></Button>
                <Button onClick={onStatusChangeMaybe} style={status === 'maybe' ? { backgroundColor: '--tg-theme-button-color' } : undefined}><ListItem titleStyle={{ color: status === 'maybe' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)', alignSelf: 'center' }} titile="Maybe" /></Button>
                <Button onClick={onStatusChangeNo} style={status === 'no' ? { backgroundColor: '--tg-theme-button-color' } : undefined}><ListItem titleStyle={{ color: status === 'no' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)', alignSelf: 'center' }} titile="Decline" /></Button>
            </div>}
            {editEv && <Button disabled={disable} onClick={onDeleteClick}><ListItem titleStyle={{ color: "var(--text-destructive-color)", alignSelf: 'center' }} titile="DELETE EVENT" /></Button>}
        </div>
        <MainButtopnController isVisible={showButton} onClick={onClick} text={(editEv ? "SAVE" : "ADD") + " EVENT"} progress={loading} />
    </>
}