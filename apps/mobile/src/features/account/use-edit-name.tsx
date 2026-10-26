import { validateProfileName } from '@tourism/core';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { getAuthClient } from '@/lib/auth-client';
import { EditNameSheet } from './edit-name-sheet';

/**
 * Trạng thái và tấm sửa tên dùng chung cho Account (thẻ hồ sơ) và Personal details (hàng Name):
 * cả hai chỗ đều mở cùng một tấm A3. Trả về `open()` và phần tử `sheet` để route tự đặt vào cây.
 */
export function useEditName(currentName: string) {
  const { account } = messages.mobile;
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function open() {
    setValue(currentName);
    setError(undefined);
    setFormError(null);
    setVisible(true);
  }

  async function save() {
    const invalid = validateProfileName(value);
    if (invalid !== undefined) {
      setError(invalid);
      return;
    }
    setError(undefined);
    setFormError(null);
    setPending(true);
    try {
      const { error: apiError } = await getAuthClient().updateUser({ name: value.trim() });
      setPending(false);
      if (apiError) {
        setFormError(account.editNameError);
        return;
      }
      setVisible(false);
    } catch {
      setPending(false);
      setFormError(account.editNameError);
    }
  }

  const sheet = (
    <EditNameSheet
      visible={visible}
      onClose={() => setVisible(false)}
      label={account.editNameLabel}
      description={account.editNameDescription}
      value={value}
      error={error}
      formError={formError}
      pending={pending}
      saveLabel={account.editNameSave}
      savingLabel={account.editNameSaving}
      onChangeText={(next) => {
        setValue(next);
        setError(undefined);
      }}
      onSave={() => void save()}
    />
  );

  return { open, sheet };
}
