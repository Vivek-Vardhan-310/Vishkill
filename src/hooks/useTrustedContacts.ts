import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { TrustedContact } from '../types';

export function useTrustedContacts() {
    const [trustedContacts, setTrustedContacts] = useState<TrustedContact[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchContacts = async () => {
        if (!isSupabaseConfigured) {
            setLoading(false);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('trusted_contacts')
                .select('*');
            
            if (error) throw error;
            if (data) {
                console.log('✅ Fetched Trusted Contacts:', data);
                setTrustedContacts(data as TrustedContact[]);
            }
        } catch (err: any) {
            console.error('❌ Error fetching trusted contacts (check RLS policies):', err.message || err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, []);

    return { trustedContacts, loading, refreshContacts: fetchContacts };
}
