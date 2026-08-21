import { useEffect, useState } from 'react';

import { GEMINI_MODELS, type GeminiModel } from '@/api/keyStore';
import { ChoiceList } from '@/components/Choice';
import { Sheet } from '@/components/Sheet';
import { Body } from '@/components/Type';

interface Props {
  visible: boolean;
  activeModel: GeminiModel;
  onClose: () => void;
  onSelect: (model: GeminiModel) => void;
}

const OPTIONS = GEMINI_MODELS.map(({ id, label, benefit }) => ({
  value: id,
  label,
  detail: benefit,
}));

/** Picks the model new estimates start with. Mise falls back to the others automatically if it is rate-limited. */
export function ModelSheet({ visible, activeModel, onClose, onSelect }: Props) {
  const [selected, setSelected] = useState(activeModel);

  useEffect(() => setSelected(activeModel), [activeModel, visible]);

  const choose = (model: GeminiModel) => {
    setSelected(model);
    onSelect(model);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Google AI model">
      <Body muted>
        Choose the model new estimates start with. If it is rate-limited, Mise tries the other models automatically.
      </Body>
      <ChoiceList options={OPTIONS} value={selected} onChange={choose} />
    </Sheet>
  );
}
