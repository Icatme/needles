function mergeLayoutProfile(base, overrides) {
    const result = Array.isArray(base) ? [...base] : { ...base };

    Object.entries(overrides || {}).forEach(([key, value]) => {
        const baseValue = result[key];
        const mergeable = value
            && typeof value === 'object'
            && !Array.isArray(value)
            && baseValue
            && typeof baseValue === 'object'
            && !Array.isArray(baseValue);
        result[key] = mergeable
            ? mergeLayoutProfile(baseValue, value)
            : value;
    });

    return result;
}

function freezeLayoutProfile(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freezeLayoutProfile);
    return Object.freeze(value);
}

const CLASSIC_LAYOUT_PROFILE = {
    id: 'classic',
    family: 'classic',
    label: '经典 3:4',
    design: {
        width: 600,
        height: 800,
        minDisplayWidth: 300,
        maxDisplayWidth: 1200
    },
    boot: {
        mark: { x: 84, y: 302 },
        label: { x: 132, y: 264 },
        title: { x: 128, y: 292 },
        status: { x: 132, y: 354 },
        track: { x: 132, y: 398, width: 336 },
        retryY: 466
    },
    menu: {
        brand: { x: 470, y: 198 },
        title: {
            kicker: { x: 56, y: 92 },
            heading: { x: 52, y: 126 },
            subtitle: { x: 56, y: 292 }
        },
        progress: {
            panelY: 398,
            labelY: 369,
            valueY: 410,
            statusY: 398
        },
        theme: {
            labelY: 454,
            optionY: 494,
            optionXs: [190, 410]
        },
        buttons: {
            primaryY: 568,
            secondaryY: 632,
            resetY: 700,
            compactResetY: 648,
            footerY: 760
        },
        modal: {
            panelY: 390,
            labelY: 304,
            titleY: 338,
            descriptionY: 386,
            actionY: 464
        },
        backgroundFocusY: 330,
        backgroundQuietStartY: 420
    },
    game: {
        wheel: { x: 300, y: 330, radius: 88 },
        readyNeedleY: 700,
        failureSnapshotArea: { x: 0, y: 100, width: 600, height: 420 },
        hud: {
            leftX: 40,
            rightX: 560,
            brandY: 28,
            captionY: 48,
            valueY: 82,
            progressY: 114,
            progressWidth: 520
        },
        footer: {
            panelCenterY: 766,
            panelWidth: 480,
            panelHeight: 58,
            upperY: 754,
            lowerY: 777,
            dotX: 84,
            textX: 100,
            motionTrackX: 340,
            motionTrackWidth: 176,
            keyX: 516
        },
        outcome: {
            centerY: 400,
            panelWidth: 430,
            panelHeight: 180,
            ruleX: 118,
            textX: 142
        },
        backgroundFocusY: 330,
        backgroundQuietStartY: 420
    },
    result: {
        failure: {
            stateY: 92,
            preview: {
                centerX: 236,
                centerY: 260,
                imageWidth: 360,
                imageHeight: 252,
                frameWidth: 376,
                frameHeight: 268
            },
            glyph: { x: 500, y: 260, radius: 46 },
            metricY: 456,
            primaryY: 574,
            secondaryY: 642,
            footerY: 718
        },
        success: {
            stateY: 102,
            titleY: 142,
            glyph: { x: 490, y: 226, radius: 50 },
            metricY: 384,
            primaryY: 520,
            secondaryY: 588,
            footerY: 680
        },
        metric: {
            panelWidth: 488,
            panelHeight: 106,
            labelOffsetY: -26,
            valueOffsetY: 7
        },
        backgroundFocusY: 330,
        backgroundQuietStartY: 420
    },
    levelSelect: {
        pageSize: 10,
        header: {
            menuButton: { x: 74, y: 50 },
            title: { x: 54, y: 82 },
            note: { x: 546, y: 98 }
        },
        playtestHeader: {
            exportButton: { x: 416, y: 46 },
            clearButton: { x: 532, y: 46 },
            count: { x: 546, y: 72 }
        },
        packPickerY: 164,
        chapter: {
            buttonY: 226,
            titleY: 218,
            counterY: 244
        },
        grid: {
            startX: 80,
            startY: 342,
            columnGap: 110,
            rowGap: 128,
            columns: 5
        },
        paginationY: 510,
        detail: {
            panelY: 626,
            panelHeight: 126,
            titleY: 584,
            ruleY: 616,
            metricsY: 652
        },
        footerY: 746,
        backgroundFocusY: 330,
        backgroundQuietStartY: 420
    },
    background: {
        topHudHeight: 120,
        outerFrame: { x: 18, y: 18, width: 564, height: 764, radius: 28 },
        innerFrame: { x: 24, y: 24, width: 552, height: 752, radius: 24 },
        footerPanel: { x: 16, y: 740, width: 568, height: 48 },
        modes: {
            menu: {
                focusY: 330,
                topGlowY: 170,
                quietStartY: 420,
                quietEndY: 720,
                sideStartY: 150,
                sideEndY: 580
            },
            game: {
                focusY: 330,
                topGlowY: 170,
                quietStartY: 420,
                quietEndY: 720,
                sideStartY: 150,
                sideEndY: 580
            },
            'game-over': {
                focusY: 330,
                topGlowY: 170,
                quietStartY: 420,
                quietEndY: 720,
                sideStartY: 150,
                sideEndY: 580
            }
        }
    }
};

const PHONE_9_16_LAYOUT_PROFILE = mergeLayoutProfile(CLASSIC_LAYOUT_PROFILE, {
    id: 'phone-9-16',
    family: 'phone',
    label: '手机 9:16',
    design: {
        height: 1064
    },
    boot: {
        mark: { y: 430 },
        label: { y: 392 },
        title: { y: 420 },
        status: { y: 482 },
        track: { y: 526 },
        retryY: 594
    },
    menu: {
        brand: { y: 225 },
        title: {
            kicker: { y: 108 },
            heading: { y: 142 },
            subtitle: { y: 310 }
        },
        progress: {
            panelY: 455,
            labelY: 426,
            valueY: 467,
            statusY: 455
        },
        theme: {
            labelY: 535,
            optionY: 580
        },
        buttons: {
            primaryY: 720,
            secondaryY: 792,
            resetY: 874,
            compactResetY: 800,
            footerY: 1018
        },
        modal: {
            panelY: 540,
            labelY: 454,
            titleY: 488,
            descriptionY: 536,
            actionY: 614
        },
        backgroundFocusY: 390,
        backgroundQuietStartY: 500
    },
    game: {
        wheel: { y: 430 },
        readyNeedleY: 900,
        failureSnapshotArea: { y: 220 },
        hud: {
            brandY: 42,
            captionY: 66,
            valueY: 100,
            progressY: 136
        },
        footer: {
            panelCenterY: 1018,
            upperY: 1006,
            lowerY: 1029
        },
        outcome: {
            centerY: 532
        },
        backgroundFocusY: 430,
        backgroundQuietStartY: 540
    },
    result: {
        failure: {
            stateY: 112,
            preview: { centerY: 330 },
            glyph: { y: 330 },
            metricY: 540,
            primaryY: 690,
            secondaryY: 762,
            footerY: 1014
        },
        success: {
            stateY: 126,
            titleY: 170,
            glyph: { y: 270 },
            metricY: 500,
            primaryY: 650,
            secondaryY: 722,
            footerY: 1010
        },
        backgroundFocusY: 390,
        backgroundQuietStartY: 500
    },
    levelSelect: {
        header: {
            menuButton: { y: 60 },
            title: { y: 104 },
            note: { y: 120 }
        },
        playtestHeader: {
            exportButton: { y: 58 },
            clearButton: { y: 58 },
            count: { y: 88 }
        },
        packPickerY: 210,
        chapter: {
            buttonY: 284,
            titleY: 276,
            counterY: 302
        },
        grid: {
            startY: 430,
            rowGap: 150
        },
        paginationY: 670,
        detail: {
            panelY: 820,
            panelHeight: 150,
            titleY: 770,
            ruleY: 808,
            metricsY: 846
        },
        footerY: 1008,
        backgroundFocusY: 390,
        backgroundQuietStartY: 500
    },
    background: {
        outerFrame: { height: 1028 },
        innerFrame: { height: 1016 },
        footerPanel: { y: 1004 },
        modes: {
            menu: {
                focusY: 390,
                topGlowY: 190,
                quietStartY: 500,
                quietEndY: 984,
                sideEndY: 930
            },
            game: {
                focusY: 430,
                topGlowY: 190,
                quietStartY: 540,
                quietEndY: 984,
                sideEndY: 930
            },
            'game-over': {
                focusY: 390,
                topGlowY: 190,
                quietStartY: 500,
                quietEndY: 984,
                sideEndY: 930
            }
        }
    }
});

const PHONE_TALL_LAYOUT_PROFILE = mergeLayoutProfile(PHONE_9_16_LAYOUT_PROFILE, {
    id: 'phone-tall',
    label: '手机超长屏',
    design: {
        height: 1200
    },
    boot: {
        mark: { y: 490 },
        label: { y: 452 },
        title: { y: 480 },
        status: { y: 542 },
        track: { y: 586 },
        retryY: 654
    },
    menu: {
        brand: { y: 245 },
        progress: {
            panelY: 500,
            labelY: 471,
            valueY: 512,
            statusY: 500
        },
        theme: {
            labelY: 595,
            optionY: 645
        },
        buttons: {
            primaryY: 810,
            secondaryY: 886,
            resetY: 974,
            compactResetY: 890,
            footerY: 1145
        },
        modal: {
            panelY: 600,
            labelY: 514,
            titleY: 548,
            descriptionY: 596,
            actionY: 674
        },
        backgroundFocusY: 430,
        backgroundQuietStartY: 560
    },
    game: {
        wheel: { y: 480 },
        readyNeedleY: 1010,
        failureSnapshotArea: { y: 270 },
        footer: {
            panelCenterY: 1154,
            upperY: 1142,
            lowerY: 1165
        },
        outcome: {
            centerY: 600
        },
        backgroundFocusY: 480,
        backgroundQuietStartY: 600
    },
    result: {
        failure: {
            stateY: 126,
            preview: { centerY: 370 },
            glyph: { y: 370 },
            metricY: 620,
            primaryY: 790,
            secondaryY: 862,
            footerY: 1145
        },
        success: {
            stateY: 140,
            titleY: 190,
            glyph: { y: 300 },
            metricY: 560,
            primaryY: 720,
            secondaryY: 792,
            footerY: 1135
        },
        backgroundFocusY: 430,
        backgroundQuietStartY: 560
    },
    levelSelect: {
        header: {
            menuButton: { y: 70 },
            title: { y: 120 },
            note: { y: 140 }
        },
        playtestHeader: {
            exportButton: { y: 68 },
            clearButton: { y: 68 },
            count: { y: 100 }
        },
        packPickerY: 240,
        chapter: {
            buttonY: 320,
            titleY: 312,
            counterY: 338
        },
        grid: {
            startY: 480,
            rowGap: 170
        },
        paginationY: 760,
        detail: {
            panelY: 930,
            panelHeight: 160,
            titleY: 876,
            ruleY: 916,
            metricsY: 956
        },
        footerY: 1140,
        backgroundFocusY: 430,
        backgroundQuietStartY: 560
    },
    background: {
        outerFrame: { height: 1164 },
        innerFrame: { height: 1152 },
        footerPanel: { y: 1140 },
        modes: {
            menu: {
                focusY: 430,
                topGlowY: 210,
                quietStartY: 560,
                quietEndY: 1120,
                sideEndY: 1060
            },
            game: {
                focusY: 480,
                topGlowY: 210,
                quietStartY: 600,
                quietEndY: 1120,
                sideEndY: 1060
            },
            'game-over': {
                focusY: 430,
                topGlowY: 210,
                quietStartY: 560,
                quietEndY: 1120,
                sideEndY: 1060
            }
        }
    }
});

const LAYOUT_PROFILES = freezeLayoutProfile({
    classic: CLASSIC_LAYOUT_PROFILE,
    'phone-9-16': PHONE_9_16_LAYOUT_PROFILE,
    'phone-tall': PHONE_TALL_LAYOUT_PROFILE
});
