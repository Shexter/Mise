import { ApiKeyForm } from '@/components/ApiKeyForm';
import { Sheet } from '@/components/Sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

/** Replace-key sheet, reusing the shared form. */
export function ApiKeySheet({ visible, onClose, onSaved }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="API key">
      <ApiKeyForm
        onSaved={async () => {
          await onSaved();
          onClose();
        }}
        saveLabel="Save key"
      />
    </Sheet>
  );
}
