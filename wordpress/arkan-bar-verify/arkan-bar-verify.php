<?php
/**
 * Plugin Name: Arkan Gold — استعلام اصالت شمش
 * Description: ثبت کد ۶ رقمی اصالت شمش‌های آرکان گلد (به همراه مشخصات شمش و مالک) و ارائه API عمومی استعلام برای صفحه arkan.gold/verify.
 * Version:     2.0.0
 * Author:      Arkan Gold
 * Requires PHP: 7.4
 *
 * API:
 *   GET /wp-json/arkan/v1/verify-bar?code=123456
 *
 * پاسخ‌ها:
 *   200 {"valid":true,"status":"valid","code":"123456","product":"...","product_code":"...","gtin":"...",
 *        "dimensions":"...","weight":"100 گرم","purity":"۷۵۰ (۱۸ عیار)","country":"ایران",
 *        "manufacturer":"Zarmahan Gold","brand":"آرکان گلد / ARKAN GOLD",
 *        "owner_name":"...","owned_at":"2026-10-01"}
 *   200 {"valid":false,"status":"revoked","code":"123456"}   ← کد باطل/مفقودی اعلام شده
 *   404 {"valid":false,"status":"not_found"}
 *   429 {"valid":false,"status":"rate_limited"}
 */

if (!defined('ABSPATH')) {
    exit;
}

const ARKAN_BAR_CPT = 'arkan_bar';
const ARKAN_BAR_CODE_LENGTH = 6;
const ARKAN_BAR_RATE_LIMIT = 30;          // حداکثر درخواست
const ARKAN_BAR_RATE_WINDOW = 10 * 60;    // در هر ۱۰ دقیقه برای هر IP

/** اعداد فارسی/عربی به لاتین */
function arkan_bar_latin_digits($value)
{
    return strtr((string) $value, [
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
        '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    ]);
}

/** کد اصالت: فقط ارقام لاتین */
function arkan_bar_normalize_code($value)
{
    return preg_replace('/\D+/', '', arkan_bar_latin_digits($value));
}

function arkan_bar_is_valid_code($code)
{
    return (bool) preg_match('/^\d{' . ARKAN_BAR_CODE_LENGTH . '}$/', $code);
}

/* ------------------------------------------------------------------
 * نوع محتوای «شمش» (فقط در پیشخوان، غیرعمومی)
 * ------------------------------------------------------------------ */
add_action('init', function () {
    register_post_type(ARKAN_BAR_CPT, [
        'labels' => [
            'name'          => 'شمش‌های آرکان',
            'singular_name' => 'شمش',
            'add_new'       => 'ثبت شمش جدید',
            'add_new_item'  => 'ثبت شمش جدید',
            'edit_item'     => 'ویرایش شمش',
            'search_items'  => 'جستجوی کد',
            'not_found'     => 'شمشی یافت نشد',
        ],
        'public'          => false,
        'show_ui'         => true,
        'show_in_menu'    => true,
        'menu_icon'       => 'dashicons-shield',
        'supports'        => ['title'],
        'capability_type' => 'post',
        'map_meta_cap'    => true,
    ]);
});

/**
 * فیلدهای هر شمش: کلید متا => [برچسب، کلید ستون CSV / پاسخ API، مقدار پیش‌فرض، راهنما]
 */
function arkan_bar_fields()
{
    return [
        '_ab_code'         => ['کد ۶ رقمی اصالت', 'code', '', 'فقط عدد، دقیقاً ۶ رقم — مثال: 123456'],
        '_ab_product'      => ['نام محصول', 'product', '', 'مثال: شمش طلا 100 گرمی (عیار 750)'],
        '_ab_product_code' => ['کد محصول', 'product_code', '', 'مثال: 6260320777981'],
        '_ab_gtin'         => ['کد GTIN', 'gtin', '', 'مثال: 2041231'],
        '_ab_dimensions'   => ['ابعاد', 'dimensions', '', 'مثال: 51 × 30/40 میلی‌متر / ضخامت 3/34 میلی‌متر'],
        '_ab_weight'       => ['وزن', 'weight', '', 'مثال: 100 گرم (اگر فقط عدد وارد شود «گرم» اضافه می‌شود)'],
        '_ab_purity'       => ['عیار', 'purity', '۷۵۰ (۱۸ عیار)', ''],
        '_ab_country'      => ['کشور سازنده', 'country', 'ایران', ''],
        '_ab_manufacturer' => ['شرکت سازنده', 'manufacturer', 'Zarmahan Gold', ''],
        '_ab_brand'        => ['برند', 'brand', 'آرکان گلد / ARKAN GOLD', ''],
        '_ab_owner_name'   => ['نام و نام خانوادگی مالک', 'owner_name', '', ''],
        '_ab_owned_at'     => ['تاریخ مالکیت', 'owned_at', '', 'میلادی 2026-10-01 یا شمسی ۱۴۰۵/۰۷/۰۹'],
    ];
}

add_action('add_meta_boxes', function () {
    add_meta_box('arkan_bar_details', 'مشخصات شمش و مالک', 'arkan_bar_render_meta_box', ARKAN_BAR_CPT, 'normal', 'high');
});

function arkan_bar_render_meta_box($post)
{
    wp_nonce_field('arkan_bar_save', 'arkan_bar_nonce');
    $is_new = $post->post_status === 'auto-draft';
    echo '<table class="form-table">';
    foreach (arkan_bar_fields() as $key => [$label, , $default, $hint]) {
        $value = get_post_meta($post->ID, $key, true);
        if ($value === '' && $is_new) {
            $value = $default;
        }
        $extra = $key === '_ab_code'
            ? ' inputmode="numeric" maxlength="6" pattern="[0-9۰-۹]{6}" required dir="ltr" style="letter-spacing:4px;font-weight:bold"'
            : '';
        printf(
            '<tr><th><label for="%1$s">%2$s</label></th><td><input type="text" id="%1$s" name="%1$s" value="%3$s" class="regular-text"%4$s>%5$s</td></tr>',
            esc_attr($key),
            esc_html($label),
            esc_attr($value),
            $extra, // ثابت؛ بدون ورودی کاربر
            $hint ? '<p class="description">' . esc_html($hint) . '</p>' : ''
        );
    }
    $status = get_post_meta($post->ID, '_ab_status', true) ?: 'valid';
    echo '<tr><th><label for="_ab_status">وضعیت</label></th><td><select id="_ab_status" name="_ab_status">';
    foreach (['valid' => 'معتبر', 'revoked' => 'باطل / مفقودی'] as $k => $l) {
        printf('<option value="%s"%s>%s</option>', esc_attr($k), selected($status, $k, false), esc_html($l));
    }
    echo '</select></td></tr></table>';
}

/** شناسه‌ی شمشی که این کد را دارد (به‌جز $exclude_id) */
function arkan_bar_find_by_code($code, $exclude_id = 0)
{
    $ids = get_posts([
        'post_type'      => ARKAN_BAR_CPT,
        'post_status'    => ['publish', 'draft', 'pending', 'private'],
        'posts_per_page' => 1,
        'fields'         => 'ids',
        'no_found_rows'  => true,
        'post__not_in'   => $exclude_id ? [$exclude_id] : [],
        'meta_query'     => [['key' => '_ab_code', 'value' => $code]],
    ]);
    return $ids ? (int) $ids[0] : 0;
}

/** ذخیره‌ی مقدار یک فیلد (وزن عددی ← «... گرم») */
function arkan_bar_clean_value($key, $raw)
{
    if ($key === '_ab_code') {
        return arkan_bar_normalize_code($raw);
    }
    $value = sanitize_text_field($raw);
    if ($key === '_ab_weight' && preg_match('/^[\d.]+$/', arkan_bar_latin_digits($value))) {
        $value .= ' گرم';
    }
    return $value;
}

add_action('save_post_' . ARKAN_BAR_CPT, function ($post_id) {
    if (!isset($_POST['arkan_bar_nonce']) || !wp_verify_nonce(sanitize_key($_POST['arkan_bar_nonce']), 'arkan_bar_save')) {
        return;
    }
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }
    if (!current_user_can('edit_post', $post_id)) {
        return;
    }

    $error = '';
    foreach (array_keys(arkan_bar_fields()) as $key) {
        if (!isset($_POST[$key])) {
            continue;
        }
        $value = arkan_bar_clean_value($key, wp_unslash($_POST[$key]));
        if ($key === '_ab_code') {
            if (!arkan_bar_is_valid_code($value)) {
                $error = 'کد اصالت باید دقیقاً ۶ رقم عددی باشد؛ کد ذخیره نشد.';
                continue;
            }
            if (arkan_bar_find_by_code($value, $post_id)) {
                $error = sprintf('کد %s قبلاً برای شمش دیگری ثبت شده است؛ کد ذخیره نشد.', $value);
                continue;
            }
        }
        update_post_meta($post_id, $key, $value);
    }
    $status = isset($_POST['_ab_status']) && $_POST['_ab_status'] === 'revoked' ? 'revoked' : 'valid';
    update_post_meta($post_id, '_ab_status', $status);

    if ($error) {
        set_transient('arkan_bar_error_' . get_current_user_id(), $error, 60);
    }

    // عنوان پست = کد (برای جستجو در پیشخوان)
    $code = get_post_meta($post_id, '_ab_code', true);
    if ($code && get_the_title($post_id) !== $code) {
        remove_all_actions('save_post_' . ARKAN_BAR_CPT);
        wp_update_post(['ID' => $post_id, 'post_title' => $code]);
    }
});

add_action('admin_notices', function () {
    $key = 'arkan_bar_error_' . get_current_user_id();
    $error = get_transient($key);
    if ($error) {
        delete_transient($key);
        echo '<div class="notice notice-error"><p>' . esc_html($error) . '</p></div>';
    }
});

/* ستون‌های فهرست شمش‌ها در پیشخوان */
add_filter('manage_' . ARKAN_BAR_CPT . '_posts_columns', function ($cols) {
    return [
        'cb'          => $cols['cb'],
        'title'       => 'کد اصالت',
        'ab_product'  => 'محصول',
        'ab_weight'   => 'وزن',
        'ab_owner'    => 'مالک',
        'ab_owned_at' => 'تاریخ مالکیت',
        'ab_status'   => 'وضعیت',
        'date'        => $cols['date'],
    ];
});
add_action('manage_' . ARKAN_BAR_CPT . '_posts_custom_column', function ($col, $post_id) {
    $map = [
        'ab_product'  => '_ab_product',
        'ab_weight'   => '_ab_weight',
        'ab_owner'    => '_ab_owner_name',
        'ab_owned_at' => '_ab_owned_at',
    ];
    if (isset($map[$col])) {
        echo esc_html(get_post_meta($post_id, $map[$col], true));
    } elseif ($col === 'ab_status') {
        echo get_post_meta($post_id, '_ab_status', true) === 'revoked' ? '❌ باطل' : '✅ معتبر';
    }
}, 10, 2);

/* جستجوی پیشخوان: نام مالک و نام محصول هم جستجو می‌شوند */
add_action('pre_get_posts', function ($query) {
    if (!is_admin() || !$query->is_main_query() || $query->get('post_type') !== ARKAN_BAR_CPT || !$query->get('s')) {
        return;
    }
    $term = $query->get('s');
    $ids = get_posts([
        'post_type'      => ARKAN_BAR_CPT,
        'post_status'    => 'any',
        'posts_per_page' => 200,
        'fields'         => 'ids',
        'meta_query'     => [
            'relation' => 'OR',
            ['key' => '_ab_code', 'value' => arkan_bar_normalize_code($term) ?: $term, 'compare' => 'LIKE'],
            ['key' => '_ab_owner_name', 'value' => $term, 'compare' => 'LIKE'],
            ['key' => '_ab_product', 'value' => $term, 'compare' => 'LIKE'],
        ],
    ]);
    if ($ids) {
        $query->set('s', '');
        $query->set('post__in', $ids);
    }
});

/* ------------------------------------------------------------------
 * درون‌ریزی گروهی از CSV
 * ستون‌ها: code,product,product_code,gtin,dimensions,weight,purity,country,manufacturer,brand,owner_name,owned_at,status
 * ------------------------------------------------------------------ */
add_action('admin_menu', function () {
    add_submenu_page(
        'edit.php?post_type=' . ARKAN_BAR_CPT,
        'درون‌ریزی CSV',
        'درون‌ریزی CSV',
        'edit_posts',
        'arkan-bar-import',
        'arkan_bar_render_import_page'
    );
});

function arkan_bar_csv_columns()
{
    $cols = [];
    foreach (arkan_bar_fields() as [, $column]) {
        $cols[] = $column;
    }
    $cols[] = 'status';
    return $cols;
}

function arkan_bar_render_import_page()
{
    if (!current_user_can('edit_posts')) {
        return;
    }
    $message = '';
    $skipped = [];
    if (!empty($_FILES['arkan_bar_csv']['tmp_name']) && check_admin_referer('arkan_bar_import')) {
        $handle = fopen($_FILES['arkan_bar_csv']['tmp_name'], 'r');
        $created = 0;
        $updated = 0;
        $header = null;
        $line = 0;
        while ($handle && ($row = fgetcsv($handle)) !== false) {
            $line++;
            if ($header === null) {
                $header = array_map(function ($h) {
                    return strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', $h)));
                }, $row);
                continue;
            }
            if (count(array_filter($row, 'strlen')) === 0) {
                continue;
            }
            $data = array_combine($header, array_slice(array_pad($row, count($header), ''), 0, count($header)));
            $code = arkan_bar_normalize_code($data['code'] ?? '');
            // اکسل صفرهای ابتدای کد را حذف می‌کند (012345 → 12345)
            if ($code !== '' && strlen($code) < ARKAN_BAR_CODE_LENGTH) {
                $code = str_pad($code, ARKAN_BAR_CODE_LENGTH, '0', STR_PAD_LEFT);
            }
            if (!arkan_bar_is_valid_code($code)) {
                $skipped[] = $line;
                continue;
            }
            $post_id = arkan_bar_find_by_code($code);
            if (!$post_id) {
                $post_id = wp_insert_post(['post_type' => ARKAN_BAR_CPT, 'post_status' => 'publish', 'post_title' => $code]);
                $created++;
            } else {
                $updated++;
            }
            foreach (arkan_bar_fields() as $key => [, $column, $default]) {
                $value = $key === '_ab_code' ? $code : arkan_bar_clean_value($key, $data[$column] ?? '');
                update_post_meta($post_id, $key, $value !== '' ? $value : $default);
            }
            update_post_meta($post_id, '_ab_status', ($data['status'] ?? '') === 'revoked' ? 'revoked' : 'valid');
        }
        if ($handle) {
            fclose($handle);
        }
        $message = sprintf('%d شمش جدید ثبت و %d شمش به‌روزرسانی شد.', $created, $updated);
        if ($skipped) {
            $message .= ' ردیف‌های با کد نامعتبر (رد شده): ' . implode('، ', $skipped);
        }
    }
    echo '<div class="wrap"><h1>درون‌ریزی کدهای اصالت شمش</h1>';
    if ($message) {
        echo '<div class="notice notice-success"><p>' . esc_html($message) . '</p></div>';
    }
    echo '<p>فایل CSV (UTF-8) با ستون‌های زیر؛ ردیف اول باید نام ستون‌ها باشد. اگر کدی از قبل ثبت شده باشد، اطلاعات آن به‌روزرسانی می‌شود.</p>';
    echo '<p><code dir="ltr">' . esc_html(implode(',', arkan_bar_csv_columns())) . '</code></p>';
    echo '<p>status: <code>valid</code> یا <code>revoked</code> — ستون‌های خالیِ عیار، کشور سازنده، شرکت سازنده و برند با مقدار پیش‌فرض پر می‌شوند. فایل نمونه: <code>sample-bars.csv</code> کنار همین افزونه.</p>';
    echo '<form method="post" enctype="multipart/form-data">';
    wp_nonce_field('arkan_bar_import');
    echo '<input type="file" name="arkan_bar_csv" accept=".csv" required> ';
    submit_button('درون‌ریزی', 'primary', 'submit', false);
    echo '</form></div>';
}

/* ------------------------------------------------------------------
 * REST API عمومی استعلام
 * ------------------------------------------------------------------ */
add_action('rest_api_init', function () {
    register_rest_route('arkan/v1', '/verify-bar', [
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'args'                => [
            'code' => ['required' => true, 'type' => 'string'],
        ],
        'callback'            => 'arkan_bar_verify_endpoint',
    ]);
});

function arkan_bar_verify_endpoint(WP_REST_Request $request)
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
    $rl_key = 'arkan_bar_rl_' . md5($ip);
    $hits = (int) get_transient($rl_key);
    if ($hits >= ARKAN_BAR_RATE_LIMIT) {
        return arkan_bar_response(['valid' => false, 'status' => 'rate_limited'], 429);
    }
    set_transient($rl_key, $hits + 1, ARKAN_BAR_RATE_WINDOW);

    $code = arkan_bar_normalize_code($request->get_param('code'));
    if (!arkan_bar_is_valid_code($code)) {
        return arkan_bar_response(['valid' => false, 'status' => 'not_found'], 404);
    }

    $ids = get_posts([
        'post_type'      => ARKAN_BAR_CPT,
        'post_status'    => 'publish',
        'posts_per_page' => 1,
        'fields'         => 'ids',
        'no_found_rows'  => true,
        'meta_query'     => [['key' => '_ab_code', 'value' => $code]],
    ]);
    $post_id = $ids ? (int) $ids[0] : 0;
    if (!$post_id) {
        return arkan_bar_response(['valid' => false, 'status' => 'not_found'], 404);
    }

    if (get_post_meta($post_id, '_ab_status', true) === 'revoked') {
        return arkan_bar_response(['valid' => false, 'status' => 'revoked', 'code' => $code], 200);
    }

    $data = ['valid' => true, 'status' => 'valid'];
    foreach (arkan_bar_fields() as $key => [, $column]) {
        $data[$column] = (string) get_post_meta($post_id, $key, true);
    }
    $data['code'] = $code;
    return arkan_bar_response($data, 200);
}

function arkan_bar_response(array $data, $status)
{
    $response = new WP_REST_Response($data, $status);
    $response->header('Cache-Control', 'no-store');
    return $response;
}
