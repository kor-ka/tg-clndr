import React from "react";
import { useSearchParams } from "react-router-dom";
import { SessionModel } from "../model/SessionModel";
import { DurationDscrpitor, Event, NotifyBeforeOptions, Notification, RecurrenceOptions } from "../shared/entity";
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

    const initialEndDate = React.useMemo(() => {
        if (editEv?.endDate) {
            return new Date(editEv.endDate);
        } else {
            // Default: startDate + 1 hour
            return new Date(startDate.getTime() + 60 * 60 * 1000);
        }
    }, [editEv, startDate]);

    const [date, setDate] = React.useState(startDate);
    const [endDate, setEndDate] = React.useState(initialEndDate);
    const [validationError, setValidationError] = React.useState<string | null>(null);

    // Recurrence state
    const [recurrence, setRecurrence] = React.useState<string>(editEv?.recurrent ?? '');

    const onRecurrenceChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setRecurrence(value);
        setEdited(true);
    }, []);

    // Check if this is a recurring event
    const isRecurringEvent = !!editEv?.recurrent;

    // Reactive validation: check dates whenever they change
    React.useEffect(() => {
        if (endDate.getTime() < date.getTime()) {
            setValidationError("The start date must be before the end date.");
        } else {
            setValidationError(null);
        }
    }, [date, endDate]);

    const onDateInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newStartDate = new Date(e.target.value);
        const duration = endDate.getTime() - date.getTime();
        setDate(newStartDate);
        // Preserve duration when start date changes
        setEndDate(new Date(newStartDate.getTime() + duration));
        setEdited(true);
    }, [date, endDate]);

    const onEndDateInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setEndDate(new Date(e.target.value));
        setEdited(true);
    }, []);

    const goBack = useGoBack();
    const [handleOperation, loading] = useHandleOperation();

    disable = disable || loading;

    //
    // ADD/SAVE
    //
    const doSave = React.useCallback((updateFutureEvents: boolean) => {
        const eventData = {
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            id: editEv?.id ?? model!.nextId() + '',
            title: title.trim(),
            description: description.trim(),
            date: date.getTime(),
            endDate: endDate.getTime(),
            recurrent: recurrence || undefined,
        };

        if (editEv) {
            handleOperation(
                () => model!.commitCommand({
                    type: 'update',
                    event: {
                        ...eventData,
                        udpateFutureRecurringEvents: updateFutureEvents,
                    }
                }), goBack)
        } else {
            handleOperation(
                () => model!.commitCommand({
                    type: 'create',
                    event: eventData
                }), goBack)
        }
    }, [date, endDate, title, description, model, editEv, handleOperation, goBack, recurrence]);

    const onClick = React.useCallback(() => {
        // Check if there's a validation error
        if (validationError) {
            return;
        }

        if (!model) {
            return;
        }

        // Check if we're adding recurrence to a non-recurring event
        const isAddingRecurrence = !isRecurringEvent && !!recurrence;

        // For recurring events being edited, ask about future events
        if (editEv && isRecurringEvent) {
            showConfirm("Apply changes to all future events in this series?", (updateFuture) => {
                doSave(updateFuture);
            });
        } else {
            // When adding recurrence, automatically create future events
            doSave(isAddingRecurrence);
        }

    }, [validationError, model, editEv, isRecurringEvent, recurrence, doSave]);

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
    const doDelete = React.useCallback((deleteFutureEvents: boolean) => {
        if (model && editEvId) {
            handleOperation(() =>
                model.commitCommand({
                    type: 'delete',
                    id: editEvId,
                    deleteFutureRecurringEvents: deleteFutureEvents || undefined
                }), goBack)
        }
    }, [model, editEvId, handleOperation, goBack]);

    const onDeleteClick = React.useCallback(() => {
        if (isRecurringEvent) {
            // For recurring events, first ask about future events
            showConfirm("Also delete all future events in this series?", (deleteFuture) => {
                const message = deleteFuture
                    ? "Delete this and all future events? This cannot be undone."
                    : "Delete this event? This cannot be undone.";
                showConfirm(message, (confirmed) => {
                    if (confirmed) {
                        doDelete(deleteFuture);
                    }
                });
            });
        } else {
            showConfirm("Delete event? This cannot be undone.", (confirmed) => {
                if (confirmed) {
                    doDelete(false);
                }
            });
        }
    }, [isRecurringEvent, doDelete]);

    const upsertAvailable = (!editEv || edited) && canEdit;

    const crazyDateFormat = React.useMemo(() => {
        var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
        return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, -8);
    }, [date]);

    const crazyEndDateFormat = React.useMemo(() => {
        var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
        return (new Date(endDate.getTime() - tzoffset)).toISOString().slice(0, -8);
    }, [endDate]);

    return <Page>
        <BackButtonController />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 0px' }}>

            <Card>
                <input value={title} onChange={onTitleInputChange} disabled={disable || !canEdit} style={{ flexGrow: 1, padding: '8px 0', background: 'var(--tg-theme-secondary-bg-color)' }} placeholder="Title" />
            </Card>

            <Card>
                <ListItem
                    titile="Starts"
                    right={<input value={crazyDateFormat} onChange={onDateInputChange} disabled={disable || !canEdit} type="datetime-local" style={{ background: 'var(--tg-theme-secondary-bg-color)', padding: '8px 0', margin: '0px 0px' }} />}
                />
            </Card>

            <Card>
                <ListItem
                    titile="Ends"
                    right={<input value={crazyEndDateFormat} onChange={onEndDateInputChange} disabled={disable || !canEdit} type="datetime-local" style={{ background: 'var(--tg-theme-secondary-bg-color)', padding: '8px 0', margin: '0px 0px' }} />}
                />
            </Card>

            {validationError && <Card style={{ backgroundColor: 'var(--text-destructive-color)', color: 'white' }}>
                <ListItem titile={validationError} />
            </Card>}

            {(userSettings.experimentalFeatures || isRecurringEvent) && <Card>
                <ListItem
                    titile="Repeat"
                    right={
                        <select
                            value={recurrence}
                            onChange={onRecurrenceChange}
                            disabled={disable || !canEdit}
                            style={{ background: 'var(--tg-theme-secondary-bg-color)', padding: '8px 0' }}
                        >
                            <option value="">Never</option>
                            <option value={RecurrenceOptions.daily}>Daily</option>
                            <option value={RecurrenceOptions.weekly}>Weekly</option>
                            <option value={RecurrenceOptions.biweekly}>Every 2 weeks</option>
                            <option value={RecurrenceOptions.monthly}>Monthly</option>
                            <option value={RecurrenceOptions.yearly}>Yearly</option>
                        </select>
                    }
                />
            </Card>}

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