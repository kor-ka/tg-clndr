import React from "react";
import { useSearchParams } from "react-router-dom";
import { SessionModel } from "../model/SessionModel";
import { DurationDscrpitor, Event, NotifyBeforeOptions, Notification } from "../shared/entity";
import { useVMvalue } from "../utils/vm/useVM";
import { UsersProviderContext, UserContext } from "./App";
import { ListItem, UserPic, Card, Button, Page, CardLight, Block } from "./uikit/kit";
import { BackButtonController } from "./uikit/tg/BackButtonController";
import { ClosingConfirmationController } from "./uikit/tg/ClosingConfirmationController";
import { MainButtonController } from "./uikit/tg/MainButtonController";
import { useHandleOperation } from "./useHandleOperation";
import { useGoBack, useGoHome } from "./utils/navigation/useGoHome";
import { showConfirm } from "./utils/webapp";
import { WithModel } from "./utils/withModelHOC";

const Attendee = React.memo(({ uid, status }: { uid: number, status: 'yes' | 'no' | 'maybe' }) => {
    const usersModule = React.useContext(UsersProviderContext)
    const user = useVMvalue(usersModule.getUser(uid))
    return <ListItem titleView={<div style={{ display: 'flex', flexDirection: "row", alignItems: 'center' }}><UserPic uid={uid} style={{ marginRight: 8 }} />{user.fullName}</div>} right={status === 'yes' ? '✅' : status === 'no' ? '🙅' : status === 'maybe' ? '🤔' : ''} />
})

const NotificationComponent = WithModel(React.memo((({ model, cahedEvent }: { model: SessionModel, cahedEvent: Event }) => {
    const event = useVMvalue(model.eventsModule.getEventVM(cahedEvent.id)!)

    const [handleOperation, loading] = useHandleOperation()

    const updateNotification = React.useCallback((notifyBefore: DurationDscrpitor | null) => {
        handleOperation(() => model.updateNotification(event.id, { notifyBefore }))
    }, [event, handleOperation])

    const onAlertChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        updateNotification(e.target.value === 'none' ? null : e.target.value as any)
    }, [updateNotification])

    return <>
        <Card >
            <ListItem
                titile="Alert"
                right={
                    <select disabled={loading} onChange={onAlertChange} value={event.notification?.notifyBefore ?? 'none'}>
                        <option value={'none'}>None</option>
                        {NotifyBeforeOptions.map(o => <option>{o}</option>)}
                    </select>
                } />
        </Card>
    </>
})))


const EventScreen = WithModel(({ model }: { model: SessionModel }) => {
    const chatSettings = useVMvalue(model.chatSettings);
    const userSettings = useVMvalue(model.userSettings);
    const context = useVMvalue(model.context);
    const canEdit = (chatSettings.allowPublicEdit || context.isAdmin);

    const uid = React.useContext(UserContext);

    let [searchParams] = useSearchParams();

    const editEvId = searchParams.get("editEvent");
    const editEv: Event | undefined = editEvId ? model?.eventsModule.useEvent(editEvId) : undefined;

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

    const startDate = React.useMemo(() => {
        const startDateStr = searchParams.get("selectedDate");
        if (editEv?.date) {
            return new Date(editEv?.date);
        } else if (startDateStr) {
            let date = new Date(Number(startDateStr));
            return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 13);
        } else {
            let nowDate = new Date();
            return new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), nowDate.getHours() + 1);
        }

    }, [editEv])


    const [date, setDate] = React.useState(startDate);
    const onDateInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDate(new Date(e.target.value));
        setEdited(true);
    }, []);

    const goBack = useGoBack();
    const [handleOperation, loading] = useHandleOperation();

    disable = disable || loading;

    // 
    // ADD/SAVE
    // 
    const onClick = React.useCallback(() => {
        if (model) {
            handleOperation(
                () => model.commitCommand({
                    type: editEv ? 'update' : 'create',
                    event: {
                        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        id: editEv?.id ?? model.nextId() + '',
                        title: title.trim(),
                        description: description.trim(),
                        date: date.getTime(),
                    }
                }), goBack)
        }

    }, [date, title, description, model, editEv, handleOperation, goBack]);

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
            handleOperation(() => model.updateStatus(editEvId, s));
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
                handleOperation(() =>
                    model.commitCommand({
                        type: 'delete',
                        id: editEvId
                    }), goBack)
            }
        })
    }, [model, editEvId, handleOperation, goBack]);

    const upsertAvailable = (!editEv || edited) && canEdit;

    const crazyDateFormat = React.useMemo(() => {
        var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
        return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, -8);
    }, [date]);

    return <Page style={{ height: '100vh', minHeight: '100%', overflowY: 'scroll' }}>
        <BackButtonController />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 0px' }}>

            <Card>
                <input value={title} onChange={onTitleInputChange} disabled={disable || !canEdit} style={{ flexGrow: 1, padding: '8px 0', background: 'var(--tg-theme-secondary-bg-color)' }} placeholder="Title" />
            </Card>

            <Card>
                <input value={crazyDateFormat} onChange={onDateInputChange} disabled={disable || !canEdit} type="datetime-local" style={{ flexGrow: 1, background: 'var(--tg-theme-secondary-bg-color)', padding: '8px 0', margin: '0px 0px' }} />
            </Card>


            <Card>
                <textarea value={description} onChange={onDescriptionInputChange} disabled={disable || !canEdit} style={{ flexGrow: 1, padding: '8px 0', background: 'var(--tg-theme-secondary-bg-color)', height: 128 }} placeholder="Description" />
            </Card>

            {editEv && <Card style={{ flexDirection: 'row', padding: 0, alignSelf: 'center' }}>
                <Button key={'yes'} onClick={onStatusChangeYes} disabled={disable} style={{ backgroundColor: status === 'yes' ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)', margin: 0 }}><span style={{ color: status === 'yes' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)', alignSelf: 'center' }} >Accept</span></Button>
                <Button key={'maybe'} onClick={onStatusChangeMaybe} disabled={disable} style={{ backgroundColor: status === 'maybe' ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)', margin: 0 }}><span style={{ color: status === 'maybe' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)', alignSelf: 'center' }} >Maybe</span></Button>
                <Button key={'no'} onClick={onStatusChangeNo} disabled={disable} style={{ backgroundColor: status === 'no' ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)', margin: 0 }}><span style={{ color: status === 'no' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)', alignSelf: 'center' }} >Decline</span></Button>
            </Card>}

            {userSettings.enableNotifications && editEv && <NotificationComponent cahedEvent={editEv} />}

            {((editEv?.attendees.yes.length ?? 0) > 0) && <Card key={'yes'}>{editEv?.attendees.yes.map(uid => <Attendee key={uid} uid={uid} status="yes" />)}</Card>}
            {((editEv?.attendees.maybe.length ?? 0) > 0) && <Card key={'maybe'}>{editEv?.attendees.maybe.map(uid => <Attendee key={uid} uid={uid} status="maybe" />)}</Card>}
            {((editEv?.attendees.no.length ?? 0) > 0) && <Card key={'no'}>{editEv?.attendees.no.map(uid => <Attendee key={uid} uid={uid} status="no" />)}</Card>}
            <Block>
                {editEv && canEdit && <Button disabled={disable} onClick={onDeleteClick} ><span style={{ color: "var(--text-destructive-color)", alignSelf: 'center' }}>DELETE EVENT</span></Button>}
            </Block>

        </div>
        {upsertAvailable && <ClosingConfirmationController />}
        <MainButtonController isVisible={upsertAvailable} onClick={onClick} text={editEv ? "SAVE" : "ADD EVENT"} progress={loading} />
    </Page>
})

export default EventScreen