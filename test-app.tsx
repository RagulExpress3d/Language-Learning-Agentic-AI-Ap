// Minimal test to isolate the blank screen issue
import React from 'react';

export default function TestApp() {
  return (
    <div style={{ padding: '20px', background: '#f0f0f0' }}>
      <h1>Test App - If you see this, React is working!</h1>
      <p>This is a minimal test component.</p>
    </div>
  );
}
