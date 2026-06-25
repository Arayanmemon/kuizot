import { useState } from 'react';

// TODO: Wire these feature flags to the backend feature-flags endpoint in a later phase.

interface FeatureFlag {
  id: string;
  label: string;
  description: string;
}

const FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'image_questions',
    label: 'Image Questions',
    description: 'Allow quiz owners to attach images to questions.',
  },
  {
    id: 'team_organizations',
    label: 'Team Organizations',
    description: 'Enable multi-user organization accounts.',
  },
];

export const SettingsPage = () => {
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEATURE_FLAGS.map((f) => [f.id, false]))
  );

  const toggle = (id: string) => {
    setFlags((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-gray-900 min-h-full space-y-6">
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">Feature Flags</h2>
        <p className="text-gray-400 text-sm mb-4">
          Toggle platform features. Changes are local-only for now — backend wiring comes in a later phase.
        </p>

        <div className="space-y-3">
          {FEATURE_FLAGS.map((flag) => (
            <label
              key={flag.id}
              className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={flags[flag.id] ?? false}
                onChange={() => toggle(flag.id)}
                className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600 cursor-pointer"
              />
              <div>
                <p className="text-white text-sm font-medium">{flag.label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{flag.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
