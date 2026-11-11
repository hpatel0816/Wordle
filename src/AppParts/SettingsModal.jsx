import React from 'react';
import Modal from './Modal';

// One on/off setting, rendered as an accessible switch.
function SettingSwitch({ id, label, description, checked, disabled, onChange }) {
  return (
    <div className="setting">
      <div className="settingText">
        <span id={`${id}-label`} className="settingLabel">{label}</span>
        {description && (
          <span id={`${id}-desc`} className="settingDescription">{description}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        className="switch"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => !disabled && onChange(!checked)}
      >
        <span className="switchKnob" />
      </button>
    </div>
  );
}

// settings: array of { id, label, description, checked, disabled, onChange }
function SettingsModal({ settings, onClose, children }) {
  return (
    <Modal title="Settings" titleId="settings-title" onClose={onClose}>
      {settings.map((setting) => (
        <SettingSwitch key={setting.id} {...setting} />
      ))}
      {children}
    </Modal>
  );
}

export default SettingsModal;
