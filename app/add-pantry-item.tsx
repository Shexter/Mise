import { useRouter } from 'expo-router';
import { AddPantryItemSheet } from '@/components/pantry/AddPantryItemSheet';

/** Standalone manual recovery entry point used from saved receipt review. */
export default function AddPantryItemScreen() {
  const router = useRouter();
  return <AddPantryItemSheet visible onClose={() => router.back()} />;
}
