---
name: frontend-development
description: "Use when: working on Next.js frontend, building React components, styling with Tailwind, or integrating API calls. Enforces TypeScript strict mode, component patterns, error handling, and proper state management."
applyTo: "frontend/src/**/*.{ts,tsx}"
---

# Frontend Development Guidelines

## Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **UI**: React 18+
- **Styling**: Tailwind CSS
- **HTTP Client**: Fetch API with custom wrapper
- **State**: React hooks (useState, useContext, useEffect)

## Project Structure

```
frontend/
├── src/
│   ├── app/              # Next.js pages (app router)
│   │   ├── page.tsx      # Home page
│   │   ├── layout.tsx    # Root layout
│   │   ├── admin/
│   │   ├── audit/
│   │   ├── checklist/
│   │   ├── documents/
│   │   ├── evaluation/
│   │   └── gap-analysis/
│   ├── components/       # Reusable components
│   │   ├── Sidebar.tsx
│   │   ├── DocumentCard.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── LoadingSpinner.tsx
│   ├── lib/              # Utilities & API client
│   │   └── api.ts        # Centralized API client
│   ├── hooks/            # Custom React hooks
│   │   ├── useApi.ts
│   │   └── useAuth.ts
│   ├── types/            # TypeScript interfaces
│   │   ├── index.ts
│   │   ├── api.ts
│   │   └── models.ts
│   └── styles/           # Global styles if needed
├── public/               # Static assets
├── package.json
├── tsconfig.json         # TypeScript strict mode
└── tailwind.config.js
```

## Type Safety

### TypeScript Best Practices
- **Always use strict mode** (`"strict": true` in tsconfig.json)
- Never use `any` type - be specific
- Use interfaces for API responses
- Define component prop types

```typescript
// Good
interface DocumentCardProps {
  document: Document;
  onDelete?: (id: number) => void;
  loading?: boolean;
}

export function DocumentCard({ document, onDelete, loading }: DocumentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(document.id);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">{document.filename}</h3>
      <p className="text-sm text-gray-500">{document.size} bytes</p>
      {onDelete && (
        <button
          onClick={handleDelete}
          disabled={isDeleting || loading}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      )}
    </div>
  );
}

// Bad
export function DocumentCard(props: any) {
  const handleDelete = () => {
    props.onDelete(props.document.id);
  };
  
  return <div>...</div>;
}
```

### API Type Definitions
```typescript
// types/models.ts
export interface Document {
  id: number;
  filename: string;
  size: number;
  created_at: string;  // ISO date string
  chunk_count: number;
}

export interface RAGResponse {
  answer: string;
  sources: Source[];
  confidence: number;
}

export interface Source {
  id: number;
  filename: string;
}

export interface ApiError {
  detail: string;
  status: number;
}
```

## API Client (lib/api.ts)

Single source of truth for backend communication:

```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8050';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { params, ...fetchOptions } = options;
    
    const url = new URL(`${API_URL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      credentials: 'include',
      ...fetchOptions,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: 'Unknown error',
      }));
      throw new Error(error.detail || 'API request failed');
    }

    return response.json() as Promise<T>;
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

## Component Patterns

### Page Component with Data Fetching
```typescript
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Document } from '@/types';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get<Document[]>('/documents');
        setDocuments(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documents');
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Documents</h1>
      {documents.length === 0 ? (
        <p className="text-gray-500">No documents found</p>
      ) : (
        <div className="grid gap-4">
          {documents.map(doc => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Reusable Component
```typescript
'use client';

import React from 'react';

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-black hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} disabled:opacity-50 disabled:cursor-not-allowed`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? '...' : children}
    </button>
  );
}
```

### Custom Hook
```typescript
// hooks/useApi.ts
import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/types';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

export function useApi<T>(
  endpoint: string,
  autoFetch = true
) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: autoFetch,
    error: null,
  });

  const fetch = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await apiClient.get<T>(endpoint);
      setState({ data, loading: false, error: null });
    } catch (err) {
      const error = {
        detail: err instanceof Error ? err.message : 'Unknown error',
        status: 500,
      };
      setState({ data: null, loading: false, error });
    }
  }, [endpoint]);

  return { ...state, fetch };
}
```

## Styling with Tailwind

### Consistent Class Organization
```typescript
// Classes in order: display → sizing → spacing → typography → colors → effects

className="flex items-center justify-between mx-4 p-2 text-lg font-semibold text-white rounded-lg bg-blue-600 shadow-lg hover:bg-blue-700"
```

### Responsive Design
```typescript
// Mobile-first approach
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"

// Responsive text
className="text-sm md:text-base lg:text-lg"
```

## Error Handling

### Error Boundary Component
```typescript
'use client';

import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-100 border border-red-400 rounded text-red-700">
          <h2 className="font-bold">Something went wrong</h2>
          <p className="text-sm">{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Handle API Errors
```typescript
async function handleApiCall() {
  try {
    const data = await apiClient.post('/action', { /* payload */ });
    setSuccess(true);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    setError(message);
    
    // Log for debugging
    console.error('API call failed:', err);
  }
}
```

## Form Handling

```typescript
interface FormData {
  name: string;
  email: string;
  message: string;
}

export function ContactForm() {
  const [data, setData] = useState<FormData>({
    name: '',
    email: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post('/contact', data);
      setData({ name: '', email: '', message: '' });
      // Show success message
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        name="name"
        value={data.name}
        onChange={handleChange}
        placeholder="Your name"
        required
        className="w-full px-3 py-2 border rounded"
      />
      <input
        type="email"
        name="email"
        value={data.email}
        onChange={handleChange}
        placeholder="Your email"
        required
        className="w-full px-3 py-2 border rounded"
      />
      <textarea
        name="message"
        value={data.message}
        onChange={handleChange}
        placeholder="Your message"
        required
        className="w-full px-3 py-2 border rounded"
        rows={5}
      />
      {error && <p className="text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

## Environment Variables

```env
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8050
```

The `NEXT_PUBLIC_` prefix makes it available in the browser.

## Useful Commands

```bash
cd frontend

# Development server
bun dev

# Build for production
bun run build
bun run start

# Linting
bun run lint

# Type checking
bun run type-check

# Format code
bun run format
```

## Code Standards

### Naming Conventions
- **Components**: PascalCase (e.g., `DocumentCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useApi.ts`)
- **Variables/constants**: camelCase
- **Constants**: UPPER_SNAKE_CASE

### File Organization
```typescript
// 1. Imports
import React, { useState } from 'react';
import { apiClient } from '@/lib/api';

// 2. Types
interface Props {
  // ...
}

// 3. Component
export function MyComponent(props: Props) {
  // ...
}

// 4. Exports
export default MyComponent;
```

### Exports
```typescript
// Prefer named exports for easier refactoring
export function DocumentCard() { }
export function DocumentList() { }

// Use default export only for pages
export default DocumentsPage;
```

## Common Patterns

### Loading State
```typescript
{loading && <p>Loading...</p>}
{!loading && data && <div>{/* render data */}</div>}
{!loading && !data && <p>No data found</p>}
```

### Conditional Rendering
```typescript
// Prefer this
{isVisible && <Component />}

// Over this
{isVisible ? <Component /> : null}
```

### Event Handling
```typescript
// Always type events
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
  // ...
};

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  // ...
};
```

## When Stuck

1. **API integration issues** → Check `lib/api.ts` and network tab
2. **Styling problems** → Check Tailwind classes and browser DevTools
3. **State management** → Use React DevTools to inspect component state
4. **Type errors** → Run `tsc --noEmit` to check all types
5. **Layout issues** → Check `src/app/layout.tsx` for global styles
