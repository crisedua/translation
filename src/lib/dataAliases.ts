export const FIELD_ALIASES = {
    // Personal Information
    personal: {
        nombres: ['nombre', 'nombres', 'given_names', 'name', 'primer_nombre'],
        primer_apellido: ['primer_apellido', 'first_surname', 'apellido_paterno'],
        segundo_apellido: ['segundo_apellido', 'second_surname', 'apellido_materno'],
        apellidos: ['apellido', 'apellidos', 'surnames', 'family_name'],
        nuip: ['nuip', 'nip', 'numero_identificacion', 'id_number', 'cedula', 'NUIP'],
        sexo: ['sexo', 'genero', 'sex', 'gender', 'Sex', 'Sex (in words)', 'MASCULINO', 'FEMENINO'],
        grupo_sanguineo: ['grupo_sanguineo', 'blood_type', 'tipo_sangre'],
        factor_rh: ['factor_rh', 'rh', 'rh_factor'],
        estatura: ['estatura', 'height'],
    },

    // Birth Details
    birth: {
        fecha_nacimiento: ['fecha_nacimiento', 'fecha_nac', 'date_of_birth', 'birth_date'],
        hora_nacimiento: ['hora_nacimiento', 'hora', 'time_of_birth', 'birth_time'],
        pais_nacimiento: ['pais_nacimiento', 'pais_nac', 'country_of_birth', 'birth_country'],
        departamento_nacimiento: ['departamento_nacimiento', 'depto_nac', 'birth_department'],
        municipio_nacimiento: ['municipio_nacimiento', 'mpio_nac', 'ciudad_nacimiento', 'birth_city', 'birth_municipality'],
        lugar_nacimiento: ['lugar_nacimiento', 'sitio_nacimiento', 'birth_place', 'hospital', 'clinica', 'domicilio'],
        vereda: ['vereda', 'township', 'birth_township'],
        corregimiento: ['corregimiento', 'birth_corregimiento'],
    },

    // Parent Information
    parents: {
        padre_nombres: ['nombre_padre', 'padre_nombres', 'father_name', 'Father\'s Surnames and Full Names'],
        padre_apellidos: ['apellido_padre', 'padre_apellidos', 'father_surname'],
        padre_identificacion: ['cc_padre', 'id_padre', 'father_id', 'padre_identificacion', 'Father\'s Identification Document'],
        padre_tipo_documento: ['padre_tipo_documento', 'father_doc_type'],
        padre_nacionalidad: ['nacionalidad_padre', 'padre_nacionalidad', 'father_nationality', 'Father\'s Nationality'],

        madre_nombres: ['nombre_madre', 'madre_nombres', 'mother_name', 'Mother\'s Surnames and Full Names'],
        madre_apellidos: ['apellido_madre', 'madre_apellidos', 'mother_surname'],
        madre_identificacion: ['cc_madre', 'id_madre', 'mother_id', 'madre_identificacion', 'Mother\'s Identification Document'],
        madre_tipo_documento: ['madre_tipo_documento', 'mother_doc_type'],
        madre_nacionalidad: ['nacionalidad_madre', 'madre_nacionalidad', 'mother_nationality', 'Mother\'s Nationality'],
    },

    // Declarant Information
    declarant: {
        declarante_nombres: ['declarante_nombres', 'nombre_declarante', 'declarant_name', 'Declarant\'s Surnames and Full Names'],
        declarante_identificacion: ['declarante_identificacion', 'cc_declarante', 'declarant_id', 'Declarant\'s Identification Document'],
        declarante_tipo_documento: ['declarante_tipo_documento', 'declarant_doc_type'],
    },

    // Witness Information
    witnesses: {
        testigo1_nombres: ['testigo1_nombres', 'nombre_testigo1', 'first_witness_name', 'First Witness\'s Surnames and Full Names'],
        testigo1_identificacion: ['testigo1_identificacion', 'cc_testigo1', 'first_witness_id', 'First Witness\'s Identification Document'],
        testigo2_nombres: ['testigo2_nombres', 'nombre_testigo2', 'second_witness_name', 'Second Witness\'s Surnames and Full Names'],
        testigo2_identificacion: ['testigo2_identificacion', 'cc_testigo2', 'second_witness_id', 'Second Witness\'s Identification Document'],
    },

    // Office/Registration Information
    registration: {
        oficina: ['oficina', 'notaria', 'registraduria', 'office', 'registry', 'registry_office'],
        tipo_oficina: ['tipo_oficina', 'office_type'],
        numero_oficina: ['numero_oficina', 'num_notaria', 'office_number', 'notary_number'],
        ciudad_registro: ['ciudad_registro', 'municipio_registro', 'registration_city', 'reg_municipality'],
        departamento_registro: ['departamento_registro', 'registration_department', 'reg_department'],
        pais_registro: ['pais_registro', 'country_registration', 'registration_country', 'reg_country'],
        fecha_registro: ['fecha_registro', 'date_of_registration'],
        consulado: ['consulado', 'consulate'],
    },

    // Document Identifiers
    identifiers: {
        codigo: ['codigo', 'code', 'reg_code'],
        serial: ['serial', 'numero_serial', 'serial_number', 'serial_indicator'],
        acta: ['acta', 'numero_acta', 'record_number', 'birth_cert_number'],
        folio: ['folio', 'page'],
        libro: ['libro', 'book'],
        tomo: ['tomo', 'volume'],
    },

    // Notes and Prior Documents
    notes: {
        notas: ['notas', 'observaciones', 'limitaciones', 'notes', 'comments', 'notas_marginales'],
        tipo_documento_anterior: ['tipo_documento_anterior', 'prior_doc', 'prior_document'],
    },

    // Official Information
    official: {
        funcionario_nombre: ['funcionario_nombre', 'official_name', 'nombre_funcionario'],
        funcionario_cargo: ['funcionario_cargo', 'official_position', 'cargo_funcionario'],
    }
};

export const DOCUMENT_TYPES = {
    BIRTH_CERTIFICATE_OLD: 'registro_nacimiento_antiguo',
    BIRTH_CERTIFICATE_MEDIUM: 'registro_nacimiento_medio',
    BIRTH_CERTIFICATE_NEW: 'registro_nacimiento_nuevo',
    PASSPORT: 'pasaporte_colombia',
    MARRIAGE_CERTIFICATE: 'acta_matrimonio',
    DIAN: 'dian',
};

export const DELIVERY_TIMELINES = {
    SAME_DAY: 'same_day',
    TWENTY_FOUR_HOURS: '24_hours',
    STANDARD: 'standard',
};
