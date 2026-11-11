import React from 'react';
import Modal from './Modal';

// One on/off setting, rendered as an accessible switch.
function SettingSwitch({ id, label, description, checked, onChange }) {
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
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => onChange(!checked)}
      >
        <span className="switchKnob" />
      </button>
    </div>
  );
}

// settings: array of { id, label, description, checked, onChange }
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
