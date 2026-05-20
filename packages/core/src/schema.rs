diesel::table! {
    tasks (id) {
        id -> Text,
        prompt -> Text,
        attachments -> Nullable<Text>,
        status -> Text,
        mode -> Text,
        capabilities -> Text,
        steps -> Text,
        usage -> Nullable<Text>,
        created_at -> BigInt,
        updated_at -> BigInt,
        max_steps -> BigInt,
        timeout_ms -> BigInt,
        error -> Nullable<Text>,
        summary -> Nullable<Text>,
        source -> Nullable<Text>,
    }
}

diesel::table! {
    policy (id) {
        id -> Integer,
        workspace_root -> Nullable<Text>,
        capabilities -> Text,
        theme_mode -> Text,
        language -> Text,
        provider_active -> Text,
        provider_model -> Nullable<Text>,
        task_auto_approve -> Bool,
    }
}

diesel::table! {
    schedules (id) {
        id -> Text,
        prompt -> Text,
        capabilities -> Text,
        mode -> Text,
        frequency -> Text,
        cron_expr -> Text,
        enabled -> Bool,
        last_run_at -> Nullable<BigInt>,
        next_run_at -> BigInt,
        created_at -> BigInt,
    }
}

diesel::table! {
    projects (id) {
        id -> Text,
        name -> Text,
        color -> Text,
        created_at -> BigInt,
        task_ids -> Text,
    }
}

diesel::table! {
    channels (id) {
        id -> Text,
        enabled -> Bool,
        status -> Text,
        paired -> Bool,
        pairing_code -> Nullable<Text>,
        error -> Nullable<Text>,
        has_credentials -> Bool,
        meta -> Text,
        auto_approve -> Bool,
    }
}

diesel::allow_tables_to_appear_in_same_query!(
    tasks,
    policy,
    schedules,
    projects,
    channels,
);
