"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  ALL_CUSTOMERS,
  _addToStore,
  _loadFromStorage,
  getAllCustomers,
  updateCustomer as updateInStore,
  deleteCustomer as deleteFromStore,
  type Customer,
} from "@/lib/customers/data";

interface CustomerContextValue {
  customers: Customer[];
  addCustomer: (c: Customer) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  // Re-sync from the data layer (e.g. after a cascade delete elsewhere).
  reload: () => void;
}

const CustomerContext = createContext<CustomerContextValue>({
  customers: ALL_CUSTOMERS,
  addCustomer: () => {},
  updateCustomer: () => {},
  deleteCustomer: () => {},
  reload: () => {},
});

export function useCustomers(): CustomerContextValue {
  return useContext(CustomerContext);
}

const STORAGE_KEY = "crm-extra-customers";

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>(ALL_CUSTOMERS);

  // On mount, load any customers created in previous sessions.
  useEffect(() => {
    _loadFromStorage();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const extra = JSON.parse(raw) as Customer[];
        if (extra.length > 0) {
          setCustomers([...ALL_CUSTOMERS, ...extra]);
        }
      }
    } catch { /* ignore */ }
  }, []);

  function addCustomer(customer: Customer) {
    // 1. Update the module-level store so getCustomer() works immediately
    _addToStore(customer);

    // 2. Update React state so the list page re-renders
    setCustomers(prev => {
      const next = [...prev, customer];

      // 3. Persist only the created-at-runtime ones
      const extra = next.filter(c => !ALL_CUSTOMERS.some(b => b.id === c.id));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(extra)); } catch { /* ignore */ }

      return next;
    });
  }

  function updateCustomer(id: string, patch: Partial<Customer>) {
    // 1. Patch the module-level store (persists to localStorage)
    updateInStore(id, patch);

    // 2. Mirror into React state so list/detail pages re-render
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteCustomer(id: string) {
    // 1. Remove from the module-level store (persists to localStorage)
    deleteFromStore(id);

    // 2. Mirror into React state
    setCustomers(prev => prev.filter(c => c.id !== id));
  }

  // Re-read the data layer — used after deletions performed outside this
  // provider (e.g. a company cascade removes its customers).
  function reload() {
    _loadFromStorage();
    setCustomers(getAllCustomers());
  }

  return (
    <CustomerContext.Provider value={{ customers, addCustomer, updateCustomer, deleteCustomer, reload }}>
      {children}
    </CustomerContext.Provider>
  );
}
