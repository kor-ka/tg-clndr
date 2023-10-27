import "./switch.css";
import { ChangeEvent, FC, InputHTMLAttributes, memo, useContext } from "react";
import cx from "classnames";
import { WebApp } from "../../utils/webapp";

export interface SwitchProps extends InputHTMLAttributes<HTMLInputElement> {
}

export const Switch: FC<SwitchProps> = memo<SwitchProps>(
  ({ onChange, onClick, checked, disabled }) => {

    const onChangeCallback = (e: ChangeEvent<HTMLInputElement>) => {
      WebApp?.HapticFeedback.selectionChanged();
      onChange?.(e);
    };

    return (
      <div className={"switch_container"} >
        <label>
          <input type="checkbox" onChange={onChangeCallback} onClick={onClick} checked={checked} disabled={disabled} className={"swithc_input"} />
          <div className={cx(['switch', 'switch::after', 'swithc_apple', 'swithc_apple::after', 'swithc_apple_checked', 'swithc_apple_checked::after'])} />
        </label>
      </div >
    );
  }
);

Switch.displayName = "Switch";
