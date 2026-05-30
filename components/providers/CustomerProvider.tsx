"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  ALL_CUSTOMERS,
  _addToStore,
  _loadFromStorage,
  type Customer,
} from "@/lib/customers/data";

interface CustomerContextValue {
  customers: Customer[];
  addCustomer: (c: Customer) => void;
}

const CustomerContext = createContext<CustomerContextValue>({
  customers: ALL_CUSTOMERS,
  addCustomer: () => {},
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

  return (
    <CustomerContext.Provider value={{ customers, addCustomer }}>
      {children}
    </CustomerContext.Provider>
  );
}
