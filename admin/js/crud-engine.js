/*
 * AVENTRIX REALTY — GENERIC CRUD ENGINE
 * -------------------------------------------
 * Thin, reusable wrapper around Supabase table + storage calls.
 * Every current and future admin module (properties, and later
 * blogs/testimonials/etc.) calls through these same functions instead
 * of writing raw Supabase calls inline, so switching database
 * providers or adding logging/caching later touches one file only.
 */

const CrudEngine = {
    sb: null,

    init(client) {
        this.sb = client;
    },

    async list(table, { orderBy = "created_at", ascending = false, filters = {} } = {}) {
        let query = this.sb.from(table).select("*").order(orderBy, { ascending });
        Object.entries(filters).forEach(([col, val]) => {
            if (val !== undefined && val !== null && val !== "") query = query.eq(col, val);
        });
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getOne(table, id) {
        const { data, error } = await this.sb.from(table).select("*").eq("id", id).single();
        if (error) throw error;
        return data;
    },

    async insert(table, record) {
        const { data, error } = await this.sb.from(table).insert(record).select().single();
        if (error) throw error;
        return data;
    },

    async update(table, id, record) {
        const { data, error } = await this.sb.from(table).update(record).eq("id", id).select().single();
        if (error) throw error;
        return data;
    },

    async remove(table, id) {
        const { error } = await this.sb.from(table).delete().eq("id", id);
        if (error) throw error;
        return true;
    },

    async count(table, filters = {}) {
        let query = this.sb.from(table).select("*", { count: "exact", head: true });
        Object.entries(filters).forEach(([col, val]) => {
            if (val !== undefined && val !== null && val !== "") query = query.eq(col, val);
        });
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
    },

    // Uploads one file to a storage bucket/folder and returns its public URL.
    async uploadImage(bucket, file, folder = "") {
        const ext = file.name.split(".").pop();
        const path = `${folder}${folder ? "/" : ""}${crypto.randomUUID()}.${ext}`;
        const { error } = await this.sb.storage.from(bucket).upload(path, file, { upsert: false });
        if (error) throw error;
        const { data } = this.sb.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    },

    async uploadImages(bucket, files, folder = "") {
        const urls = [];
        for (const file of files) {
            urls.push(await this.uploadImage(bucket, file, folder));
        }
        return urls;
    }
};
