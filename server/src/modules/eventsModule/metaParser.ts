// Fixed (gets first meta/og instead of last, types fixes) version of:
// https://github.com/nasa8x/html-metadata-parser

import axios, { AxiosRequestConfig } from "axios";
import { parse as HTML, HTMLElement } from "node-html-parser";

type Meta = {
    title?: string;
    description?: string,
    image?: string
    url?: string,
    type?: string,
    site_name?: string
}

export type Metadata = {
    meta: Meta
    og: Meta
    images?: MediaImage[]
}

const readMT = (el: HTMLElement, name: string) => {
    var prop = el.getAttribute('name') || el.getAttribute('property');
    return prop == name ? el.getAttribute('content') : null;
};

export const parseMeta = async (url: string, config?: AxiosRequestConfig): Promise<Metadata | null> => {

    if (!/(^http(s?):\/\/[^\s$.?#].[^\s]*)/i.test(url)) return null;

    const { data } = await axios(url, config);

    const $ = HTML(data);
    const og: Meta = {}, meta: Meta = {}, images: MediaImage[] = [];

    const title = $.querySelector('title');
    if (title)
        meta.title = title.text;

    const canonical = $.querySelector('link[rel=canonical]');
    if (canonical) {
        meta.url = canonical.getAttribute('href');
    }


    const metas = $.querySelectorAll('meta');

    for (let i = 0; i < metas.length; i++) {
        const el = metas[i];

        (['title', 'description', 'image'] as const).forEach(s => {
            const val = readMT(el, s);
            if (val && !meta[s]) {
                meta[s] = val;
            }
        });

        ['og:title', 'og:description', 'og:image', 'og:url', 'og:site_name', 'og:type'].forEach(s => {
            const val = readMT(el, s);
            const key = s.split(':')[1] as 'title' | 'description' | 'image' | 'url' | 'site_name' | 'type'
            if (val && !og[key]) {
                og[key] = val;
            }
        });
    }


    // images
    $.querySelectorAll('img').forEach(el => {
        let src: string | undefined = el.getAttribute('src');
        if (src) {
            src = new URL(src, url).href;
            images.push({ src });
        }
    });

    return { meta, og, images };

}