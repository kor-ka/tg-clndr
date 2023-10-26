import React from "react";

export const dayViewHeight = 56;
export const calTitleHeight = 56;
export const calHeight = 6 * dayViewHeight + calTitleHeight;

export const SelectedDateContext = React.createContext<{ selectedDate: number | undefined, startDate: number, selectDate: (date: number, options?: { openCal?: boolean, forceScroll?: boolean }) => void, closeCal: () => void }>({ selectedDate: Date.now(), startDate: Date.now(), selectDate: () => { }, closeCal: () => { } })
