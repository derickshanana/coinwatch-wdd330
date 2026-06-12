/**
 * Favorites.mjs
 * Manages user favorites for currencies and crypto coins
 * Stored in localStorage under 'cw-favorites'
 */

import { getLocalStorage, setLocalStorage } from "./utils.mjs";

const STORAGE_KEY = "cw-favorites";

export const Favorites = {
    // Get all favorites, optionally filtered by type ('currency' or 'crypto')
    getFavorites(type = null) {
        const data = getLocalStorage(STORAGE_KEY) || { currency: [], crypto: [] };
        if (type) return data[type] || [];
        return data;
    },

    // Check if an item is favorited
    isFavorite(type, id) {
        return this.getFavorites(type).includes(id);
    },

    // Toggle favorite on/off
    toggle(type, id) {
        const data = getLocalStorage(STORAGE_KEY) || { currency: [], crypto: [] };
        if (!data[type]) data[type] = [];

        const idx = data[type].indexOf(id);
        if (idx === -1) {
            data[type].push(id);
        } else {
            data[type].splice(idx, 1);
        }
        setLocalStorage(STORAGE_KEY, data);
    },

    // Add a favorite
    add(type, id) {
        if (!this.isFavorite(type, id)) this.toggle(type, id);
    },

    // Remove a favorite
    remove(type, id) {
        if (this.isFavorite(type, id)) this.toggle(type, id);
    },

    // Get total count of all favorites
    getCount() {
        const data = this.getFavorites();
        return (data.currency?.length || 0) + (data.crypto?.length || 0);
    },
};
