import { CargoForm } from './CargoForm';
import { CargoList } from './CargoList';
import { AutoPanel } from './AutoPanel';

export function RightPane() {
  return (
    <aside className="right-pane">
      <CargoList />
      <CargoForm />
      <AutoPanel />
    </aside>
  );
}
