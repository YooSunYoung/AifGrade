import os
import sys
import numpy as np
import pandas as pd
from scipy import stats
from itertools import permutations 
NUM_RANKING = 3

def calculate_weighted_kendal_tau(pred, label, rnk_lst, num_rnk):
    """
    calcuate Weighted Kendal Tau Correlation
    """
    total_count = 0
    total_corr = 0
    for p, l in zip(pred, label):
        corr, _ = stats.weightedtau(num_rnk-1-rnk_lst[l], 
                                    num_rnk-1-rnk_lst[p])
        total_corr += corr
        total_count += 1
    return (total_corr / total_count)    

answer_file = os.path.join(sys.argv[1], 'answer.csv')
y_true = pd.read_csv(answer_file, header=None, encoding='utf8').to_numpy()
y_pred = pd.read_csv(sys.argv[2], header=None, encoding='utf8').to_numpy()

rnk_lst = np.array(list(permutations(np.arange(NUM_RANKING), NUM_RANKING)))

# get scores
score = np.round(calculate_weighted_kendal_tau(y_pred, y_true, rnk_lst, NUM_RANKING), 7)

print("score:", score)