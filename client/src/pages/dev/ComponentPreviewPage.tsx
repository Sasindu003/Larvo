import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { TextArea } from '../../components/ui/TextArea';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Skeleton, SkeletonCard } from '../../components/ui/Skeleton';

/* ── Helpers ──────────────────────────────────────────────── */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-4">
    <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 border-b border-ink-100 pb-2">
      {title}
    </h2>
    {children}
  </section>
);

const Row: React.FC<{ children: React.ReactNode; wrap?: boolean }> = ({ children, wrap = true }) => (
  <div className={`flex items-center gap-3 ${wrap ? 'flex-wrap' : ''}`}>{children}</div>
);

/* ── Page ─────────────────────────────────────────────────── */
export const ComponentPreviewPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');

  return (
    <div className="max-w-3xl mx-auto space-y-12 py-8">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">Dev Preview</p>
        <h1 className="font-display text-3xl font-bold text-ink-900">UI Primitives</h1>
        <p className="text-sm text-ink-500">All components, every variant — design system reference.</p>
      </div>

      {/* ── Buttons ── */}
      <Section title="Button — Variants">
        <Row>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </Row>
      </Section>

      <Section title="Button — Sizes">
        <Row>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>
      </Section>

      <Section title="Button — Loading & Disabled">
        <Row>
          <Button loading>Saving…</Button>
          <Button variant="secondary" loading size="sm">Loading</Button>
          <Button disabled>Disabled</Button>
          <Button variant="danger" loading size="lg">Processing</Button>
        </Row>
      </Section>

      {/* ── Inputs ── */}
      <Section title="Input">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            hint="We'll never share your email."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error="Password must be at least 8 characters."
          />
          <Input label="Disabled field" value="Cannot edit" disabled readOnly />
          <Input placeholder="No label, no error" />
        </div>
      </Section>

      <Section title="TextArea">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextArea label="Review" placeholder="Tell us what you think…" hint="Max 500 characters." />
          <TextArea label="Notes" placeholder="Enter notes…" error="This field is required." />
        </div>
      </Section>

      {/* ── Badges ── */}
      <Section title="Badge — All Variants">
        <Row>
          <Badge variant="discount">−30%</Badge>
          <Badge variant="new">New</Badge>
          <Badge variant="out-of-stock">Out of Stock</Badge>
          <Badge variant="default">Featured</Badge>
        </Row>
      </Section>

      {/* ── Cards ── */}
      <Section title="Card">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <p className="text-sm text-ink-700">
              Default card with <code className="text-xs bg-ink-100 px-1 rounded">p-5</code> padding and
              shadow-card border.
            </p>
          </Card>
          <Card onClick={() => alert('Card clicked!')} className="">
            <p className="text-sm text-ink-700 font-medium">Interactive card (click me)</p>
            <p className="text-xs text-ink-400 mt-1">Hover shows elevated shadow.</p>
          </Card>
          <Card flush className="col-span-full">
            <div className="bg-cream h-24 flex items-center justify-center text-xs text-ink-500 font-medium tracking-wide">
              Flush card — no padding (useful for image headers)
            </div>
            <div className="p-4">
              <p className="text-sm text-ink-700">Content below the flush area.</p>
            </div>
          </Card>
        </div>
      </Section>

      {/* ── Modal ── */}
      <Section title="Modal">
        <Row>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>
        </Row>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Example Modal">
          <p className="text-sm text-ink-700 mb-4">
            This modal is rendered via a React portal into <code>document.body</code>. Press{' '}
            <kbd className="text-xs bg-ink-100 px-1 rounded border border-ink-200">Esc</kbd> or click the
            backdrop to dismiss.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => setModalOpen(false)}>Confirm</Button>
          </div>
        </Modal>
      </Section>

      {/* ── Skeleton ── */}
      <Section title="Skeleton — Shimmer Loaders">
        <div className="space-y-3 max-w-xs">
          <Skeleton height="h-3" width="w-1/3" />
          <Skeleton height="h-6" />
          <Skeleton height="h-4" width="w-2/3" />
          <Skeleton circle height="h-10" width="w-10" />
        </div>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </Section>

      {/* ── Color Palette ── */}
      <Section title="Design Tokens — Ink Palette">
        <div className="flex gap-2 flex-wrap">
          {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
            <div key={shade} className="flex flex-col items-center gap-1">
              <div
                className={`w-10 h-10 rounded border border-ink-100 bg-ink-${shade}`}
                title={`ink-${shade}`}
              />
              <span className="text-[10px] text-ink-400">{shade}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Design Tokens — Cream / Sand">
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'cream', cls: 'bg-cream' },
            { label: 'cream-300', cls: 'bg-cream-300' },
            { label: 'sand-100', cls: 'bg-sand-100' },
            { label: 'sand-200', cls: 'bg-sand-200' },
            { label: 'sand-300', cls: 'bg-sand-300' },
            { label: 'sand-400', cls: 'bg-sand-400' },
          ].map(({ label, cls }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className={`w-12 h-10 rounded border border-ink-200 ${cls}`} title={label} />
              <span className="text-[10px] text-ink-400">{label}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};
