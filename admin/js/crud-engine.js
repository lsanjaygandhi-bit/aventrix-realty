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

    // Accepted image formats across every upload field in the admin panel.
    ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    ALLOWED_IMAGE_EXT: ["jpg", "jpeg", "png", "webp"],

    isAllowedImage(file) {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        return this.ALLOWED_IMAGE_TYPES.includes(file.type) || this.ALLOWED_IMAGE_EXT.includes(ext);
    },

    // Uploads one file to a storage bucket/folder and returns its public URL.
    async uploadImage(bucket, file, folder = "") {
        if (!this.isAllowedImage(file)) {
            throw new Error(`"${file.name}" isn't a supported image type. Use JPG, JPEG, PNG or WEBP.`);
        }
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
    },

    // Same as uploadImages, but reports progress after each file finishes
    // uploading via onProgress({ done, total, percent, fileName }). Used
    // by the admin panel to show a live progress bar during multi-image
    // uploads instead of a single blocking "Saving..." state.
    async uploadImagesWithProgress(bucket, files, folder = "", onProgress = () => {}) {
        const urls = [];
        const total = files.length;
        for (let i = 0; i < total; i++) {
            const file = files[i];
            const url = await this.uploadImage(bucket, file, folder);
            urls.push(url);
            const done = i + 1;
            onProgress({ done, total, percent: Math.round((done / total) * 100), fileName: file.name });
        }
        return urls;
    }
};
