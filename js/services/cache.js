/**
 * Cache Service (SWR Strategy)
 * ============================
 * Implements "Stale-While-Revalidate" pattern for instant UI loading.
 */

const STORAGE_PREFIX = 'van_admin_cache_v1_';

export const Cache = {
    /**
     * Get item from local storage
     * @param {string} key 
     */
    getKey(key) {
        try {
            const item = localStorage.getItem(STORAGE_PREFIX + key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.warn('Cache read failed', e);
            return null;
        }
    },

    /**
     * Set item in local storage
     * @param {string} key 
     * @param {any} data 
     */
    setKey(key, data) {
        try {
            if (data === undefined) return;
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
        } catch (e) {
            console.warn('Cache write failed', e);
        }
    },

    /**
     * Clear specific cache key or all
     * @param {string} key Optional
     */
    clear(key = null) {
        if (key) {
            localStorage.removeItem(STORAGE_PREFIX + key);
        } else {
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
            });
        }
    },

    /**
     * Execute SWR Pattern
     * @param {string} key Unique cache key (e.g. 'dashboard_stats')
     * @param {Function} fetcher Async function returning fresh data
     * @param {Function} onData Callback function(data) to update UI
     * @param {boolean} shouldDedupe If true, won't call fetcher if cache is very fresh (optional, not implemented yet)
     */
    async swr(key, fetcher, onData) {
        // 1. Instant Cache Strategy
        const cached = this.getKey(key);
        if (cached) {
            // console.debug(`[Cache] Hit for ${key}`);
            try {
                onData(cached);
            } catch (e) {
                console.error(`[Cache] Error rendering cached data for ${key}`, e);
            }
        } else {
            // console.debug(`[Cache] Miss for ${key}`);
        }

        // 2. Network Strategy (Revalidate)
        try {
            const fresh = await fetcher();

            // Only update UI if fresh data is different? 
            // For now, always update to ensure eventual consistency
            this.setKey(key, fresh);
            onData(fresh);
        } catch (e) {
            console.error(`[Cache] Fetch failed for ${key}`, e);
            // If we had no cache, this is a critical failure. 
            // The caller might want to handle it, but for UI views, logging/toast is often enough.
            if (!cached) {
                // If it's a completely failed load (no cache, no network), rethrow or show error
                throw e;
            } else {
                // We have stale data, silent fail or show toast
                console.warn(`[Cache] Using stale data for ${key}`);
            }
        }
    }
};
