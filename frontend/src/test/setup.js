import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Create a proper localStorage mock
const createStorageMock = () => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString() }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    getStore: () => store
  }
}

const localStorageMock = createStorageMock()
const sessionStorageMock = createStorageMock()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    Link: ({ children, to, ...props }) => {
      return { type: 'a', props: { href: to, ...props, children } }
    }
  }
})

vi.mock('../../src/services/api.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn()
  }
}))